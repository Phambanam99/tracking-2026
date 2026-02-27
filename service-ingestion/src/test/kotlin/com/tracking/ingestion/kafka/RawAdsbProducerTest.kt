package com.tracking.ingestion.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.CanonicalFlight
import com.tracking.ingestion.any
import com.tracking.ingestion.api.ProducerUnavailableException
import com.tracking.ingestion.metrics.IngestionMetrics
import com.tracking.ingestion.tracing.TraceContext
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import java.util.concurrent.CompletableFuture
import org.apache.kafka.clients.producer.ProducerRecord
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.support.SendResult
import reactor.test.StepVerifier

public class RawAdsbProducerTest {
    @Test
    public fun `should map producer timeout to service unavailable exception`() {
        @Suppress("UNCHECKED_CAST")
        val kafkaTemplate = mock(KafkaTemplate::class.java) as KafkaTemplate<String, String>
        val neverCompleted = CompletableFuture<SendResult<String, String>>()
        given(
            kafkaTemplate.send(
                any<ProducerRecord<String, String>>(),
            ),
        ).willReturn(neverCompleted)

        val producer = rawAdsbProducer(kafkaTemplate, publishTimeoutMillis = 5)

        StepVerifier.create(
            producer.publish(validFlight(), traceContext()),
        )
            .expectErrorSatisfies { error ->
                assertTrue(error is ProducerUnavailableException)
            }
            .verify()
    }

    private fun rawAdsbProducer(
        kafkaTemplate: KafkaTemplate<String, String>,
        publishTimeoutMillis: Long,
    ): RawAdsbProducer {
        val topicProperties = KafkaTopicProperties(raw = "raw-adsb")
        val producerProperties = IngestionKafkaProperties(publishTimeoutMillis = publishTimeoutMillis)
        val metrics = IngestionMetrics(SimpleMeterRegistry())
        return RawAdsbProducer(
            kafkaTemplate = kafkaTemplate,
            objectMapper = ObjectMapper(),
            topicProperties = topicProperties,
            recordKeyStrategy = RecordKeyStrategy(),
            producerProperties = producerProperties,
            ingestionMetrics = metrics,
        )
    }

    private fun validFlight(): CanonicalFlight {
        return CanonicalFlight(
            icao = "ICAO123",
            lat = 10.5,
            lon = 106.7,
            eventTime = 1708941600000,
            sourceId = "SRC-1",
        )
    }

    private fun traceContext(): TraceContext {
        return TraceContext(
            requestId = "req-raw-test",
            traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        )
    }
}
