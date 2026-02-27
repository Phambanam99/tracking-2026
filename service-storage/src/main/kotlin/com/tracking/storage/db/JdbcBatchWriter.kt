package com.tracking.storage.db

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.storage.model.PersistableFlight
import com.tracking.storage.model.StorageFailedRecord
import java.sql.Timestamp
import java.sql.Types
import java.time.Instant
import org.springframework.jdbc.core.BatchPreparedStatementSetter
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component

public interface StorageBatchWriter {
    public fun writeBatch(records: List<PersistableFlight>): Int

    public fun writeQuarantine(records: List<StorageFailedRecord>): Int
}

@Component
public class JdbcBatchWriter(
    private val jdbcTemplate: JdbcTemplate,
    private val objectMapper: ObjectMapper,
) : StorageBatchWriter {
    override fun writeBatch(records: List<PersistableFlight>): Int {
        if (records.isEmpty()) {
            return 0
        }

        val counts = jdbcTemplate.batchUpdate(
            INSERT_SQL,
            object : BatchPreparedStatementSetter {
                override fun setValues(statement: java.sql.PreparedStatement, index: Int) {
                    val record = records[index]
                    val flight = record.flight
                    val altitude = flight.altitude
                    val speed = flight.speed
                    val heading = flight.heading
                    statement.setString(1, flight.icao)
                    statement.setTimestamp(2, Timestamp.from(Instant.ofEpochMilli(flight.eventTime)))
                    statement.setDouble(3, flight.lat)
                    statement.setDouble(4, flight.lon)
                    if (altitude == null) {
                        statement.setNull(5, Types.DOUBLE)
                    } else {
                        statement.setDouble(5, altitude.toDouble())
                    }
                    if (speed == null) {
                        statement.setNull(6, Types.DOUBLE)
                    } else {
                        statement.setDouble(6, speed)
                    }
                    if (heading == null) {
                        statement.setNull(7, Types.DOUBLE)
                    } else {
                        statement.setDouble(7, heading)
                    }
                    statement.setString(8, flight.sourceId)
                    statement.setBoolean(9, flight.isHistorical)
                    statement.setObject(10, toJsonbOrNull(flight.metadata), Types.OTHER)
                    statement.setString(11, record.traceContext.requestId)
                    statement.setString(12, record.traceContext.traceparent)
                }

                override fun getBatchSize(): Int = records.size
            },
        )

        return counts.sumOf { count -> count.coerceAtLeast(0) }
    }

    override fun writeQuarantine(records: List<StorageFailedRecord>): Int {
        if (records.isEmpty()) {
            return 0
        }

        val counts = jdbcTemplate.batchUpdate(
            INSERT_QUARANTINE_SQL,
            object : BatchPreparedStatementSetter {
                override fun setValues(statement: java.sql.PreparedStatement, index: Int) {
                    val record = records[index]
                    statement.setString(1, record.icao)
                    statement.setObject(2, sanitizePayload(record.payload), Types.OTHER)
                    statement.setString(3, record.reason)
                    statement.setString(4, record.sourceTopic)
                    statement.setString(5, record.errorMessage)
                    statement.setString(6, record.traceContext.requestId)
                    statement.setString(7, record.traceContext.traceparent)
                }

                override fun getBatchSize(): Int = records.size
            },
        )

        return counts.sumOf { count -> count.coerceAtLeast(0) }
    }

    private fun toJsonbOrNull(value: Any?): String? {
        return if (value == null) {
            null
        } else {
            objectMapper.writeValueAsString(value)
        }
    }

    private fun sanitizePayload(payload: String): String {
        return runCatching { objectMapper.readTree(payload); payload }
            .getOrElse { objectMapper.writeValueAsString(mapOf("raw_payload" to payload)) }
    }

    private companion object {
        private const val INSERT_SQL: String =
            """
            INSERT INTO flight_positions (
                icao, event_time, lat, lon, altitude, speed, heading, source_id, is_historical, metadata, request_id, traceparent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)
            ON CONFLICT (icao, event_time, lat, lon) DO NOTHING
            """

        private const val INSERT_QUARANTINE_SQL: String =
            """
            INSERT INTO quarantine_records (
                icao, payload, reason, source_topic, error_message, request_id, traceparent
            ) VALUES (?, ?::jsonb, ?, ?, ?, ?, ?)
            """
    }
}
