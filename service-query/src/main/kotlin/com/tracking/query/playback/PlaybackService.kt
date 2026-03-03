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

@Service
public class PlaybackService(
    private val jdbcTemplate: JdbcTemplate,
    private val frameAssembler: PlaybackFrameAssembler,
) {
    public fun getPlaybackFrames(request: PlaybackFrameRequest): PlaybackFrameResponse {
        val startedAtMs = System.currentTimeMillis()
        val decodedCursor = decodeCursor(request.cursor)
        val bucketSizeMs = resolveBucketSizeMs(request)
        val effectiveMaxFrames = request.maxFrames.coerceIn(1, MAX_FRAMES_LIMIT)
        val effectiveTimeFrom = decodedCursor?.nextTimeMs ?: request.timeFrom
        // Cap scan window to exactly the time we need to fill maxFrames buckets.
        // Without this, a 5-day range with 1-minute buckets forces scanning 7200 buckets
        // even though the caller only wants 200 — causing multi-second (or timeout) queries.
        val effectiveTimeTo = minOf(request.timeTo, effectiveTimeFrom + bucketSizeMs * effectiveMaxFrames)

        val rows = jdbcTemplate.query(
            PLAYBACK_SQL,
            rowMapper,
            bucketSizeMs,                     // 1  time_bucket interval
            effectiveTimeFrom,                // 2  WHERE event_time >= ?
            effectiveTimeTo,                  // 3  WHERE event_time <= ?
            request.boundingBox.south,        // 4  lat BETWEEN south
            request.boundingBox.north,        // 5             AND north
            request.boundingBox.west,         // 6  lon BETWEEN west
            request.boundingBox.east,         // 7             AND east
            effectiveMaxFrames,               // 8  frame_rank <= maxFrames
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
        } else if (effectiveTimeTo < request.timeTo) {
            // Scan window was capped but there is more data beyond effectiveTimeTo.
            // Signal to the client that it should page forward.
            encodeCursor(effectiveTimeTo, 0)
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

        private const val ONE_HOUR_MS = 60 * 60 * 1000L
        private const val SIX_HOURS_MS = 6 * ONE_HOUR_MS
        private const val ONE_DAY_MS = 24 * ONE_HOUR_MS
        private const val SEVEN_DAYS_MS = 7 * ONE_DAY_MS

        private val PLAYBACK_SQL = """
            WITH candidates AS (
                SELECT
                    time_bucket(make_interval(secs => ? / 1000.0), fp.event_time) AS bucket_time,
                    fp.event_time,
                    fp.icao,
                    fp.lat,
                    fp.lon,
                    fp.altitude,
                    fp.speed,
                    fp.heading,
                    fp.source_id,
                    fp.metadata
                FROM storage.flight_positions fp
                WHERE fp.event_time BETWEEN to_timestamp(? / 1000.0) AND to_timestamp(? / 1000.0)
                  AND fp.lat BETWEEN ? AND ?
                  AND fp.lon BETWEEN ? AND ?
            ),
            ranked AS (
                SELECT
                    EXTRACT(EPOCH FROM bucket_time) * 1000          AS bucket_time_ms,
                    icao,
                    lat,
                    lon,
                    altitude,
                    speed,
                    heading,
                    EXTRACT(EPOCH FROM event_time) * 1000           AS event_time_ms,
                    source_id,
                    metadata->>'registration'                        AS registration,
                    metadata->>'aircraft_type'                       AS aircraft_type,
                    metadata->>'operator'                            AS operator,
                    ROW_NUMBER()  OVER (PARTITION BY bucket_time, icao ORDER BY event_time DESC) AS rn,
                    DENSE_RANK()  OVER (ORDER BY bucket_time)                                    AS frame_rank
                FROM candidates
            )
            SELECT
                bucket_time_ms::bigint  AS bucket_time_ms,
                icao,
                lat,
                lon,
                altitude,
                speed,
                heading,
                event_time_ms::bigint   AS event_time_ms,
                source_id,
                registration,
                aircraft_type,
                operator
            FROM ranked
            WHERE rn = 1
              AND frame_rank <= ?
            ORDER BY bucket_time_ms, icao
        """.trimIndent()
    }
}

private data class PlaybackCursor(
    val nextTimeMs: Long,
    val offset: Int,
)
