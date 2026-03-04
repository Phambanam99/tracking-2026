package com.tracking.query.history

import com.tracking.query.dto.FlightPositionDto
import java.sql.ResultSet
import java.sql.Timestamp
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.stereotype.Service

/**
 * Provides flight position trail history for a single ICAO within a time range.
 *
 * Queries `storage.flight_positions` using the TimescaleDB-optimized index
 * `idx_fp_icao_time (icao, event_time DESC)`.
 */
@Service
public class HistoryService(
    private val jdbcTemplate: JdbcTemplate,
) {
    public fun getHistory(icao: String, from: Long, to: Long, limit: Int): List<FlightPositionDto> {
        val sql = """
            SELECT icao, lat, lon, altitude, speed, heading, event_time, source_id
            FROM storage.flight_positions
            WHERE icao = ?
              AND event_time >= ?
              AND event_time <= ?
            ORDER BY event_time DESC
            LIMIT ?
        """.trimIndent()

        val mapper = RowMapper<FlightPositionDto> { rs: ResultSet, _ ->
            FlightPositionDto(
                icao = rs.getString("icao"),
                lat = rs.getDouble("lat"),
                lon = rs.getDouble("lon"),
                altitude = rs.getObject("altitude") as? Int,
                speed = rs.getObject("speed") as? Double,
                heading = rs.getObject("heading") as? Double,
                eventTime = rs.getTimestamp("event_time").time,
                sourceId = rs.getString("source_id"),
            )
        }
        return jdbcTemplate.query(sql, mapper, icao, Timestamp(from), Timestamp(to), limit)
    }
}
