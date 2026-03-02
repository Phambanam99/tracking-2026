package com.tracking.processing.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.CanonicalFlight
import com.tracking.common.dto.EnrichedFlight
import com.tracking.processing.any
import com.tracking.processing.metrics.ProcessingMetrics
import com.tracking.processing.tracing.ProcessingTraceContext
import com.tracking.processing.tracing.ProcessingTraceHeaders
import com.tracking.processing.tracing.TraceContextHolder
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import java.time.Duration
import java.nio.charset.StandardCharsets
import java.util.concurrent.CompletableFuture
import org.apache.kafka.clients.producer.ProducerRecord
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assertions.assertTimeoutPreemptively
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.support.SendResult

public class KafkaProducerTraceHeadersTest {
    @Test
    public fun `should propagate trace headers on processed topic publish`() {
        @Suppress("UNCHECKED_CAST")
        val kafkaTemplate = mock(KafkaTemplate::class.java) as KafkaTemplate<String, String>
        @Suppress("UNCHECKED_CAST")
        val sendResult = mock(SendResult::class.java) as SendResult<String, String>
        given(kafkaTemplate.send(any<ProducerRecord<String, String>>()))
            .willReturn(CompletableFuture.completedFuture(sendResult))

        val producer = KafkaProcessingProducer(
            kafkaTemplate = kafkaTemplate,
            objectMapper = ObjectMapper(),
            processingMetrics = ProcessingMetrics(SimpleMeterRegistry()),
        )

        TraceContextHolder.withContext(
            ProcessingTraceContext(
                requestId = "req-processing-1",
                traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
            ),
        ) {
            producer.publish("live-adsb", validEnrichedFlight())
        }

        @Suppress("UNCHECKED_CAST")
        val captor =
            ArgumentCaptor.forClass(ProducerRecord::class.java)
                as ArgumentCaptor<ProducerRecord<String, String>>
        verify(kafkaTemplate).send(captor.capture())
        val record = captor.value

        assertEquals("live-adsb", record.topic())
        assertEquals("ABC123", record.key())
        assertTrue(record.value().contains("\"event_time\":1700000000000"))
        assertTrue(record.value().contains("\"source_id\":\"radar-1\""))
        assertTrue(!record.value().contains("\"eventTime\""))
        assertTrue(!record.value().contains("\"sourceId\""))

        val requestIdHeader = record.headers().lastHeader(ProcessingTraceHeaders.REQUEST_ID)
        val traceparentHeader = record.headers().lastHeader(ProcessingTraceHeaders.TRACEPARENT)
        assertNotNull(requestIdHeader)
        assertNotNull(traceparentHeader)
        assertEquals("req-processing-1", String(requestIdHeader.value(), StandardCharsets.UTF_8))
        assertEquals(
            "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
            String(traceparentHeader.value(), StandardCharsets.UTF_8),
        )
    }

    @Test
    public fun `should propagate trace headers on dlq publish`() {
        @Suppress("UNCHECKED_CAST")
        val kafkaTemplate = mock(KafkaTemplate::class.java) as KafkaTemplate<String, String>
        @Suppress("UNCHECKED_CAST")
        val sendResult = mock(SendResult::class.java) as SendResult<String, String>
        given(kafkaTemplate.send(any<ProducerRecord<String, String>>()))
            .willReturn(CompletableFuture.completedFuture(sendResult))

        val producer = KafkaInvalidRecordDlqProducer(
            kafkaTemplate = kafkaTemplate,
            objectMapper = ObjectMapper(),
            processingMetrics = ProcessingMetrics(SimpleMeterRegistry()),
            invalidDlqTopic = "invalid-telemetry-dlq",
        )

        TraceContextHolder.withContext(
            ProcessingTraceContext(
                requestId = "req-processing-dlq-1",
                traceparent = "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01",
            ),
        ) {
            producer.publish(
                InvalidFlightRecord(
                    reason = "KEY_ICAO_MISMATCH",
                    flight = validCanonicalFlight(),
                ),
            )
        }

        @Suppress("UNCHECKED_CAST")
        val captor =
            ArgumentCaptor.forClass(ProducerRecord::class.java)
                as ArgumentCaptor<ProducerRecord<String, String>>
        verify(kafkaTemplate).send(captor.capture())
        val record = captor.value

        assertEquals("invalid-telemetry-dlq", record.topic())
        assertEquals("ABC123", record.key())

        val requestIdHeader = record.headers().lastHeader(ProcessingTraceHeaders.REQUEST_ID)
        val traceparentHeader = record.headers().lastHeader(ProcessingTraceHeaders.TRACEPARENT)
        assertNotNull(requestIdHeader)
        assertNotNull(traceparentHeader)
        assertEquals("req-processing-dlq-1", String(requestIdHeader.value(), StandardCharsets.UTF_8))
        assertEquals(
            "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01",
            String(traceparentHeader.value(), StandardCharsets.UTF_8),
        )
    }

    @Test
    public fun `should not block on broker acknowledgement for processed topic publish`() {
        @Suppress("UNCHECKED_CAST")
        val kafkaTemplate = mock(KafkaTemplate::class.java) as KafkaTemplate<String, String>
        given(kafkaTemplate.send(any<ProducerRecord<String, String>>()))
            .willReturn(CompletableFuture<SendResult<String, String>>())

        val producer = KafkaProcessingProducer(
            kafkaTemplate = kafkaTemplate,
            objectMapper = ObjectMapper(),
            processingMetrics = ProcessingMetrics(SimpleMeterRegistry()),
        )

        assertTimeoutPreemptively(Duration.ofMillis(100)) {
            producer.publish("live-adsb", validEnrichedFlight())
        }
    }

    private fun validEnrichedFlight(): EnrichedFlight =
        EnrichedFlight(
            icao = "ABC123",
            lat = 21.0285,
            lon = 105.8542,
            eventTime = 1_700_000_000_000,
            sourceId = "radar-1",
            isHistorical = false,
        )

    private fun validCanonicalFlight(): CanonicalFlight =
        CanonicalFlight(
            icao = "ABC123",
            lat = 21.0285,
            lon = 105.8542,
            eventTime = 1_700_000_000_000,
            sourceId = "radar-1",
        )
}
