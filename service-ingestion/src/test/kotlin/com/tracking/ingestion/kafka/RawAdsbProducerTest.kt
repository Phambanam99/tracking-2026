package com.tracking.ingestion.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.CanonicalFlight
import com.tracking.ingestion.any
import com.tracking.ingestion.api.ProducerUnavailableException
import com.tracking.ingestion.metrics.IngestionMetrics
import com.tracking.ingestion.tracing.TraceContext
import io.kotest.matchers.doubles.shouldBeExactly
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeoutException
import org.apache.kafka.clients.producer.ProducerRecord
import org.apache.kafka.common.KafkaException
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.support.SendResult
import reactor.test.StepVerifier

public class RawAdsbProducerTest {
    @Test
    public fun `should map enqueue timeout to service unavailable exception`() {
        @Suppress("UNCHECKED_CAST")
        val kafkaTemplate = mock(KafkaTemplate::class.java) as KafkaTemplate<String, String>
        given(
            kafkaTemplate.send(
                any<ProducerRecord<String, String>>(),
            ),
        ).willAnswer {
            throw KafkaException("buffer is full", TimeoutException("buffer full"))
        }

        val producer = rawAdsbProducer(kafkaTemplate)

        StepVerifier.create(
            producer.publish(validFlight(), traceContext()),
        )
            .expectErrorSatisfies { error ->
                assertTrue(error is ProducerUnavailableException)
            }
            .verify()
    }

    @Test
    public fun `should enqueue full batch without waiting for broker acknowledgements`() {
        @Suppress("UNCHECKED_CAST")
        val kafkaTemplate = mock(KafkaTemplate::class.java) as KafkaTemplate<String, String>
        given(
            kafkaTemplate.send(
                any<ProducerRecord<String, String>>(),
            ),
        ).willReturn(CompletableFuture<SendResult<String, String>>())

        val producer = rawAdsbProducer(kafkaTemplate)

        StepVerifier.create(
            producer.publishBatch(listOf(validFlight(), validFlight().copy(icao = "ICAO124")), traceContext()),
        )
            .expectNext(2)
            .verifyComplete()
    }

    @Test
    public fun `should record async publish failures separately from request rejection`() {
        @Suppress("UNCHECKED_CAST")
        val kafkaTemplate = mock(KafkaTemplate::class.java) as KafkaTemplate<String, String>
        val future = CompletableFuture<SendResult<String, String>>()
        given(
            kafkaTemplate.send(
                any<ProducerRecord<String, String>>(),
            ),
        ).willReturn(future)

        val meterRegistry = SimpleMeterRegistry()
        val metrics = IngestionMetrics(meterRegistry)
        val producer = rawAdsbProducer(kafkaTemplate, metrics)

        StepVerifier.create(producer.publish(validFlight(), traceContext()))
            .verifyComplete()

        future.completeExceptionally(TimeoutException("broker ack timeout"))

        meterRegistry.counter("tracking.ingestion.kafka.publish_failed").count() shouldBeExactly 1.0
        meterRegistry.counter("tracking.ingestion.rejected.producer_unavailable").count() shouldBeExactly 0.0
    }

    private fun rawAdsbProducer(
        kafkaTemplate: KafkaTemplate<String, String>,
        metrics: IngestionMetrics = IngestionMetrics(SimpleMeterRegistry()),
    ): RawAdsbProducer {
        val topicProperties = KafkaTopicProperties(raw = "raw-adsb")
        return RawAdsbProducer(
            kafkaTemplate = kafkaTemplate,
            objectMapper = ObjectMapper(),
            topicProperties = topicProperties,
            recordKeyStrategy = RecordKeyStrategy(),
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
