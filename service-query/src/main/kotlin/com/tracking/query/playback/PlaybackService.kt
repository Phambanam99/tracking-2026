package com.tracking.query.playback

import com.tracking.query.dto.PlaybackFrameMetadataDto
import com.tracking.query.dto.PlaybackFrameRequest
import com.tracking.query.dto.PlaybackFrameResponse
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.stereotype.Service
import java.nio.charset.StandardCharsets
import java.sql.ResultSet
import java.util.Base64
import kotlin.math.max

@Service
public class PlaybackService(
    private val jdbcTemplate: JdbcTemplate,
    private val frameAssembler: PlaybackFrameAssembler,
) {
    public fun getPlaybackFrames(request: PlaybackFrameRequest): PlaybackFrameResponse {
        val startedAtMs = System.currentTimeMillis()
        val decodedCursor = decodeCursor(request.cursor)
        val bucketSizeMs = resolveBucketSizeMs(request)
        val stalenessMs = request.stalenessMs ?: max(bucketSizeMs * 3, MIN_STALENESS_MS)
        val effectiveMaxFrames = request.maxFrames.coerceIn(1, MAX_FRAMES_LIMIT)
        val effectiveTimeFrom = decodedCursor?.nextTimeMs ?: request.timeFrom

        val rows = jdbcTemplate.query(
            PLAYBACK_SQL,
            rowMapper,
            effectiveTimeFrom,
            request.timeTo,
            bucketSizeMs,
            effectiveMaxFrames,
            stalenessMs,
            request.boundingBox.south,
            request.boundingBox.north,
            request.boundingBox.west,
            request.boundingBox.east,
            decodedCursor?.nextTimeMs,
            decodedCursor?.offset,
        )

        val frames = frameAssembler.assemble(rows)
        val returnedFrames = frames.size
        val hasMore = returnedFrames == effectiveMaxFrames
        val nextCursor = if (hasMore) {
            val lastTimestamp = frames.lastOrNull()?.timestamp
            if (lastTimestamp != null) {
                encodeCursor(lastTimestamp + bucketSizeMs, 0)
            } else {
                null
            }
        } else {
            null
        }

        val queryTimeMs = System.currentTimeMillis() - startedAtMs
        val totalAircraftSeen = frames
            .flatMap { it.aircraft }
            .map { it.icao }
            .toSet()
            .size

        return PlaybackFrameResponse(
            frames = frames,
            totalFrames = returnedFrames,
            returnedFrames = returnedFrames,
            hasMore = hasMore,
            nextCursor = nextCursor,
            bucketSizeMs = bucketSizeMs,
            metadata = PlaybackFrameMetadataDto(
                queryTimeMs = queryTimeMs,
                totalAircraftSeen = totalAircraftSeen,
            ),
        )
    }

    private fun resolveBucketSizeMs(request: PlaybackFrameRequest): Long {
        request.bucketSizeMs?.let { customBucket ->
            return customBucket.coerceIn(MIN_BUCKET_MS, MAX_BUCKET_MS)
        }

        val durationMs = request.timeTo - request.timeFrom
        return when {
            durationMs <= ONE_HOUR_MS -> 5_000
            durationMs <= SIX_HOURS_MS -> 15_000
            durationMs <= ONE_DAY_MS -> 30_000
            durationMs <= SEVEN_DAYS_MS -> 60_000
            else -> 300_000
        }
    }

    private fun encodeCursor(nextTimeMs: Long, offset: Int): String {
        val payload = "${nextTimeMs}:${offset}"
        return Base64.getUrlEncoder().withoutPadding().encodeToString(payload.toByteArray(StandardCharsets.UTF_8))
    }

    private fun decodeCursor(cursor: String?): PlaybackCursor? {
        if (cursor.isNullOrBlank()) {
            return null
        }

        return runCatching {
            val decoded = String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8)
            val parts = decoded.split(":")
            require(parts.size == 2)
            PlaybackCursor(
                nextTimeMs = parts[0].toLong(),
                offset = parts[1].toInt(),
            )
        }.getOrNull()
    }

    private val rowMapper = RowMapper<PlaybackQueryRow> { rs: ResultSet, _ ->
        PlaybackQueryRow(
            bucketTimeMs = rs.getLong("bucket_time_ms"),
            icao = rs.getString("icao"),
            lat = rs.getDouble("lat"),
            lon = rs.getDouble("lon"),
            altitude = rs.getObject("altitude") as? Int,
            speed = rs.getObject("speed") as? Double,
            heading = rs.getObject("heading") as? Double,
            eventTimeMs = rs.getLong("event_time_ms"),
            sourceId = rs.getString("source_id"),
            registration = rs.getString("registration"),
            aircraftType = rs.getString("aircraft_type"),
            operator = rs.getString("operator"),
        )
    }

    private companion object {
        private const val MAX_FRAMES_LIMIT = 500
        private const val MIN_BUCKET_MS = 1_000L
        private const val MAX_BUCKET_MS = 300_000L
        private const val MIN_STALENESS_MS = 60_000L

        private const val ONE_HOUR_MS = 60 * 60 * 1000L
        private const val SIX_HOURS_MS = 6 * ONE_HOUR_MS
        private const val ONE_DAY_MS = 24 * ONE_HOUR_MS
        private const val SEVEN_DAYS_MS = 7 * ONE_DAY_MS

        private val PLAYBACK_SQL = """
            WITH buckets AS (
                SELECT bucket_time, row_number() OVER (ORDER BY bucket_time) - 1 AS bucket_row
                FROM generate_series(
                    to_timestamp(? / 1000.0),
                    to_timestamp(? / 1000.0),
                    make_interval(secs => ? / 1000.0)
                ) AS bucket_time
                LIMIT ?
            ),
            paged_buckets AS (
                SELECT bucket_time
                FROM buckets
                WHERE (? IS NULL OR bucket_time >= to_timestamp(? / 1000.0))
                  AND (? IS NULL OR bucket_row >= ?)
            ),
            ranked AS (
                SELECT
                    EXTRACT(EPOCH FROM b.bucket_time) * 1000 AS bucket_time_ms,
                    fp.icao,
                    fp.lat,
                    fp.lon,
                    fp.altitude,
                    fp.speed,
                    fp.heading,
                    EXTRACT(EPOCH FROM fp.event_time) * 1000 AS event_time_ms,
                    fp.source_id,
                    fp.metadata->>'registration' AS registration,
                    fp.metadata->>'aircraft_type' AS aircraft_type,
                    fp.metadata->>'operator' AS operator,
                    ROW_NUMBER() OVER (
                        PARTITION BY b.bucket_time, fp.icao
                        ORDER BY fp.event_time DESC
                    ) AS rn
                FROM paged_buckets b
                JOIN storage.flight_positions fp
                  ON fp.event_time BETWEEN b.bucket_time - make_interval(secs => ? / 1000.0)
                                       AND b.bucket_time
                 AND fp.lat BETWEEN ? AND ?
                 AND fp.lon BETWEEN ? AND ?
            )
            SELECT
                bucket_time_ms::bigint AS bucket_time_ms,
                icao,
                lat,
                lon,
                altitude,
                speed,
                heading,
                event_time_ms::bigint AS event_time_ms,
                source_id,
                registration,
                aircraft_type,
                operator
            FROM ranked
            WHERE rn = 1
            ORDER BY bucket_time_ms, icao
        """.trimIndent()
    }
}

private data class PlaybackCursor(
    val nextTimeMs: Long,
    val offset: Int,
)
