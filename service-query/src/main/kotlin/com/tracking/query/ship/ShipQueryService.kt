package com.tracking.query.ship

import com.tracking.query.dto.ShipHistoryPositionDto
import com.tracking.query.dto.ShipSearchRequest
import com.tracking.query.dto.ShipSearchResult
import java.sql.ResultSet
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.stereotype.Service

@Service
public class ShipQueryService(
    private val jdbcTemplate: JdbcTemplate,
) {
    public fun search(query: String, limit: Int): List<ShipSearchResult> {
        val normalized = "%${query.trim().uppercase()}%"
        val sql = """
            SELECT DISTINCT ON (mmsi)
                mmsi, lat, lon, speed, course, heading, nav_status, event_time, source_id,
                vessel_name, vessel_type, imo, call_sign, destination, metadata
            FROM storage.ship_positions
            WHERE UPPER(mmsi) LIKE ?
               OR UPPER(COALESCE(vessel_name, '')) LIKE ?
               OR UPPER(COALESCE(imo, '')) LIKE ?
               OR UPPER(COALESCE(call_sign, '')) LIKE ?
               OR UPPER(COALESCE(vessel_type, '')) LIKE ?
               OR UPPER(COALESCE(destination, '')) LIKE ?
            ORDER BY mmsi, event_time DESC
            LIMIT ?
        """.trimIndent()

        return jdbcTemplate.query(sql, shipSearchResultMapper(), normalized, normalized, normalized, normalized, normalized, normalized, limit)
    }

    public fun searchHistory(request: ShipSearchRequest): List<ShipSearchResult> {
        val sql = buildString {
            append(
                """
                SELECT mmsi, lat, lon, speed, course, heading, nav_status, event_time, source_id,
                       vessel_name, vessel_type, imo, call_sign, destination, metadata
                FROM storage.ship_positions
                WHERE 1=1
                """.trimIndent(),
            )
        }
        val params = mutableListOf<Any>()
        val conditions = StringBuilder()

        request.mmsi?.let {
            conditions.append(" AND mmsi LIKE ?")
            params.add("${it}%")
        }
        request.imo?.let {
            conditions.append(" AND UPPER(COALESCE(imo, '')) LIKE ?")
            params.add("%${it.uppercase()}%")
        }
        request.callSign?.let {
            conditions.append(" AND UPPER(COALESCE(call_sign, '')) LIKE ?")
            params.add("%${it.uppercase()}%")
        }
        request.vesselName?.let {
            conditions.append(" AND UPPER(COALESCE(vessel_name, '')) LIKE ?")
            params.add("%${it.uppercase()}%")
        }
        request.vesselType?.let {
            conditions.append(" AND UPPER(COALESCE(vessel_type, '')) LIKE ?")
            params.add("%${it.uppercase()}%")
        }
        request.destination?.let {
            conditions.append(" AND UPPER(COALESCE(destination, '')) LIKE ?")
            params.add("%${it.uppercase()}%")
        }
        request.timeFrom?.let {
            conditions.append(" AND event_time >= to_timestamp(? / 1000.0)")
            params.add(it)
        }
        request.timeTo?.let {
            conditions.append(" AND event_time <= to_timestamp(? / 1000.0)")
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

        val finalSql = sql + conditions.toString() + " ORDER BY event_time DESC LIMIT ?"
        params.add(request.limit.coerceIn(1, 5000))

        return jdbcTemplate.query(finalSql, shipSearchResultMapper(), *params.toTypedArray())
    }

    public fun getHistory(mmsi: String, from: Long, to: Long, limit: Int): List<ShipHistoryPositionDto> {
        val sql = """
            SELECT mmsi, lat, lon, speed, course, heading, nav_status, event_time, source_id
            FROM storage.ship_positions
            WHERE mmsi = ?
              AND event_time >= to_timestamp(? / 1000.0)
              AND event_time <= to_timestamp(? / 1000.0)
            ORDER BY event_time DESC
            LIMIT ?
        """.trimIndent()

        val mapper = RowMapper<ShipHistoryPositionDto> { rs: ResultSet, _ ->
            ShipHistoryPositionDto(
                mmsi = rs.getString("mmsi"),
                lat = rs.getDouble("lat"),
                lon = rs.getDouble("lon"),
                speed = rs.getObject("speed") as? Double,
                course = rs.getObject("course") as? Double,
                heading = rs.getObject("heading") as? Double,
                navStatus = rs.getString("nav_status"),
                eventTime = rs.getTimestamp("event_time").time,
                sourceId = rs.getString("source_id"),
            )
        }

        return jdbcTemplate.query(sql, mapper, mmsi, from, to, limit)
    }

    private fun shipSearchResultMapper(): RowMapper<ShipSearchResult> =
        RowMapper<ShipSearchResult> { rs: ResultSet, _ ->
            val metadata = rs.getString("metadata").orEmpty()
            ShipSearchResult(
                mmsi = rs.getString("mmsi"),
                lat = rs.getDouble("lat"),
                lon = rs.getDouble("lon"),
                speed = rs.getObject("speed") as? Double,
                course = rs.getObject("course") as? Double,
                heading = rs.getObject("heading") as? Double,
                eventTime = rs.getTimestamp("event_time").time,
                sourceId = rs.getString("source_id"),
                vesselName = rs.getString("vessel_name"),
                vesselType = rs.getString("vessel_type"),
                imo = rs.getString("imo"),
                callSign = rs.getString("call_sign"),
                destination = rs.getString("destination"),
                navStatus = rs.getString("nav_status"),
                isMilitary = metadata.contains("\"is_military\":true"),
            )
        }
}
