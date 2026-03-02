package com.tracking.query.search

import com.tracking.query.cache.LiveAircraftCacheReader
import com.tracking.query.dto.AdvancedSearchRequest
import com.tracking.query.dto.SearchResult
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.stereotype.Service
import java.sql.ResultSet

/**
 * Orchestrates live and historical aircraft search.
 *
 * - Global (live) search: delegates to [LiveAircraftCacheReader] (Redis).
 * - History search: SQL query on `storage.flight_positions` (TimescaleDB read replica).
 *
 * **Schema note:** Queries use `storage.flight_positions` because service-storage Flyway
 * migrations use the `storage` schema.
 *
 * **Known limitation:** Bounding box search does not handle antimeridian crossing.
 */
@Service
public class SearchService(
    private val cacheReader: LiveAircraftCacheReader,
    private val jdbcTemplate: JdbcTemplate,
) {
    public fun searchGlobal(query: String, limit: Int): List<SearchResult> =
        cacheReader.searchLive(query, limit)

    public fun findLiveInBoundingBox(
        north: Double,
        south: Double,
        east: Double,
        west: Double,
        limit: Int,
    ): List<SearchResult> =
        cacheReader.findInBoundingBox(
            north = north,
            south = south,
            east = east,
            west = west,
            maxResults = limit,
        )

    public fun searchHistory(request: AdvancedSearchRequest): List<SearchResult> {
        val sql = buildString {
            append(
                """
                SELECT icao, lat, lon, altitude, speed, heading, event_time, source_id,
                       metadata->>'registration'   AS registration,
                       metadata->>'aircraft_type'  AS aircraft_type,
                       metadata->>'operator'       AS operator
                FROM storage.flight_positions
                WHERE 1=1
                """.trimIndent(),
            )
        }
        val params = mutableListOf<Any>()
        val conditions = StringBuilder()

        request.icao?.let {
            conditions.append(" AND UPPER(icao) LIKE ?")
            params.add("${it.uppercase()}%")
        }
        request.callsign?.let {
            conditions.append(" AND UPPER(icao) = ?")
            params.add(it.uppercase())
        }
        request.timeFrom?.let {
            conditions.append(" AND event_time >= to_timestamp(? / 1000.0)")
            params.add(it)
        }
        request.timeTo?.let {
            conditions.append(" AND event_time <= to_timestamp(? / 1000.0)")
            params.add(it)
        }
        request.altitudeMin?.let {
            conditions.append(" AND altitude >= ?")
            params.add(it)
        }
        request.altitudeMax?.let {
            conditions.append(" AND altitude <= ?")
            params.add(it)
        }
        request.speedMin?.let {
            conditions.append(" AND speed >= ?")
            params.add(it)
        }
        request.speedMax?.let {
            conditions.append(" AND speed <= ?")
            params.add(it)
        }
        request.boundingBox?.let { bb ->
            conditions.append(" AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?")
            params.addAll(listOf(bb.south, bb.north, bb.west, bb.east))
        }
        request.sourceId?.let {
            conditions.append(" AND source_id = ?")
            params.add(it)
        }

        val finalSql = sql + conditions.toString() +
            " ORDER BY event_time DESC LIMIT ?"
        params.add(request.limit.coerceIn(1, 5000))

        val mapper = RowMapper<SearchResult> { rs: ResultSet, _ ->
            SearchResult(
                icao = rs.getString("icao"),
                lat = rs.getDouble("lat"),
                lon = rs.getDouble("lon"),
                altitude = rs.getObject("altitude") as? Int,
                speed = rs.getObject("speed") as? Double,
                heading = rs.getObject("heading") as? Double,
                eventTime = rs.getTimestamp("event_time").time,
                sourceId = rs.getString("source_id"),
                registration = rs.getString("registration"),
                aircraftType = rs.getString("aircraft_type"),
                operator = rs.getString("operator"),
            )
        }
        return jdbcTemplate.query(finalSql, mapper, *params.toTypedArray())
    }
}
