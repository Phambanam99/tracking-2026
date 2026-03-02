package com.tracking.ingestion.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.CanonicalFlight
import com.tracking.ingestion.any
import com.tracking.ingestion.metrics.IngestionMetrics
import com.tracking.ingestion.tracing.TraceContext
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import java.nio.charset.StandardCharsets
import java.util.concurrent.CompletableFuture
import org.apache.kafka.clients.producer.ProducerRecord
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.support.SendResult
import reactor.test.StepVerifier

public class KafkaHeadersPropagationTest {
    @Test
    public fun `should propagate request id and traceparent into kafka headers`() {
        @Suppress("UNCHECKED_CAST")
        val kafkaTemplate = mock(KafkaTemplate::class.java) as KafkaTemplate<String, String>
        @Suppress("UNCHECKED_CAST")
        val sendResult = mock(SendResult::class.java) as SendResult<String, String>
        given(
            kafkaTemplate.send(
                any<ProducerRecord<String, String>>(),
            ),
        ).willReturn(CompletableFuture.completedFuture(sendResult))

        val producer = rawAdsbProducer(kafkaTemplate)
        val trace = TraceContext(
            requestId = "req-kafka-header-1",
            traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        )

        StepVerifier.create(producer.publish(validFlight(), trace))
            .verifyComplete()

        @Suppress("UNCHECKED_CAST")
        val recordCaptor = ArgumentCaptor.forClass(ProducerRecord::class.java) as ArgumentCaptor<ProducerRecord<String, String>>
        verify(kafkaTemplate).send(recordCaptor.capture())
        val record = recordCaptor.value

        assertEquals("raw-adsb", record.topic())
        assertEquals("ICAO123", record.key())
        assertEquals(true, record.value().contains("\"aircraft_type\":\"A321\""))
        assertEquals(true, record.value().contains("\"event_time\":1708941600000"))
        assertEquals(true, record.value().contains("\"source_id\":\"SRC-1\""))
        assertEquals(false, record.value().contains("\"aircraftType\""))
        assertEquals(false, record.value().contains("\"eventTime\""))
        assertEquals(false, record.value().contains("\"sourceId\""))

        val requestIdHeader = record.headers().lastHeader("x-request-id")
        val traceparentHeader = record.headers().lastHeader("traceparent")
        assertNotNull(requestIdHeader)
        assertNotNull(traceparentHeader)
        assertEquals("req-kafka-header-1", String(requestIdHeader.value(), StandardCharsets.UTF_8))
        assertEquals("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01", String(traceparentHeader.value(), StandardCharsets.UTF_8))
    }

    private fun rawAdsbProducer(kafkaTemplate: KafkaTemplate<String, String>): RawAdsbProducer {
        return RawAdsbProducer(
            kafkaTemplate = kafkaTemplate,
            objectMapper = ObjectMapper(),
            topicProperties = KafkaTopicProperties(raw = "raw-adsb"),
            recordKeyStrategy = RecordKeyStrategy(),
            ingestionMetrics = IngestionMetrics(SimpleMeterRegistry()),
        )
    }

    private fun validFlight(): CanonicalFlight {
        return CanonicalFlight(
            icao = "ICAO123",
            lat = 10.5,
            lon = 106.7,
            aircraftType = "A321",
            eventTime = 1708941600000,
            sourceId = "SRC-1",
        )
    }
}
