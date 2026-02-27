package com.tracking.storage.db

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.EnrichedFlight
import com.tracking.storage.any
import com.tracking.storage.model.PersistableFlight
import com.tracking.storage.model.StorageFailedRecord
import com.tracking.storage.tracing.StorageTraceContext
import java.time.Instant
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.springframework.jdbc.core.BatchPreparedStatementSetter
import org.springframework.jdbc.core.JdbcTemplate

public class JdbcBatchWriterTest {
    @Test
    public fun `should use upsert sql when writing flight batch`() {
        @Suppress("UNCHECKED_CAST")
        val jdbcTemplate = mock(JdbcTemplate::class.java) as JdbcTemplate
        given(jdbcTemplate.batchUpdate(any<String>(), any<BatchPreparedStatementSetter>()))
            .willReturn(intArrayOf(1, 1))
        val writer = JdbcBatchWriter(jdbcTemplate, ObjectMapper())

        writer.writeBatch(
            listOf(
                persistableFlight("ABC123", 1_700_000_000_000),
                persistableFlight("ABC124", 1_700_000_100_000),
            ),
        )

        val sqlCaptor = ArgumentCaptor.forClass(String::class.java)
        verify(jdbcTemplate).batchUpdate(sqlCaptor.capture(), any<BatchPreparedStatementSetter>())
        val sql = sqlCaptor.value.uppercase()
        assertTrue(sql.contains("ON CONFLICT (ICAO, EVENT_TIME, LAT, LON) DO NOTHING"))
    }

    @Test
    public fun `should write quarantine payload as jsonb`() {
        @Suppress("UNCHECKED_CAST")
        val jdbcTemplate = mock(JdbcTemplate::class.java) as JdbcTemplate
        given(jdbcTemplate.batchUpdate(any<String>(), any<BatchPreparedStatementSetter>()))
            .willReturn(intArrayOf(1))
        val writer = JdbcBatchWriter(jdbcTemplate, ObjectMapper())

        writer.writeQuarantine(
            listOf(
                StorageFailedRecord(
                    reason = "MALFORMED_PAYLOAD",
                    sourceTopic = "live-adsb",
                    payload = "{bad-json",
                    icao = "ABC123",
                    traceContext = StorageTraceContext(requestId = "req-1"),
                    errorMessage = "Unexpected token",
                ),
            ),
        )

        val sqlCaptor = ArgumentCaptor.forClass(String::class.java)
        verify(jdbcTemplate).batchUpdate(sqlCaptor.capture(), any<BatchPreparedStatementSetter>())
        val sql = sqlCaptor.value.uppercase()
        assertTrue(sql.contains("QUARANTINE_RECORDS"))
        assertTrue(sql.contains("?::JSONB"))
    }

    private fun persistableFlight(icao: String, eventTime: Long): PersistableFlight {
        return PersistableFlight(
            flight = EnrichedFlight(
                icao = icao,
                lat = 21.0285,
                lon = 105.8542,
                eventTime = eventTime,
                sourceId = "radar-1",
                isHistorical = false,
            ),
            sourceTopic = "live-adsb",
            rawPayload = """{"icao":"$icao"}""",
            traceContext = StorageTraceContext(
                requestId = "req-$icao",
                traceparent = "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01",
            ),
        )
    }
}
