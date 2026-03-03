package com.tracking.ingestion.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.CanonicalShip
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
import org.mockito.Mockito.mock
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.core.ProducerFactory
import org.springframework.kafka.support.SendResult
import reactor.test.StepVerifier

public class RawAisProducerTest {
    @Test
    public fun `should map enqueue timeout to service unavailable exception`() {
        val kafkaTemplate = kafkaTemplateThat {
            throw KafkaException("buffer is full", TimeoutException("buffer full"))
        }

        val producer = rawAisProducer(kafkaTemplate)

        StepVerifier.create(
            producer.publish(validShip(), traceContext()),
        )
            .expectErrorSatisfies { error ->
                assertTrue(error is ProducerUnavailableException)
            }
            .verify()
    }

    @Test
    public fun `should record async published ship records by source id`() {
        val future = CompletableFuture<SendResult<String, String>>()
        val kafkaTemplate = kafkaTemplateThat { future }

        val meterRegistry = SimpleMeterRegistry()
        val metrics = IngestionMetrics(meterRegistry)
        val producer = rawAisProducer(kafkaTemplate, metrics)

        StepVerifier.create(producer.publish(validShip(sourceId = "AIS-PRIMARY"), traceContext()))
            .verifyComplete()

        future.complete(mock(SendResult::class.java) as SendResult<String, String>)

        meterRegistry.counter("tracking.ingestion.kafka.published.records", "source_id", "AIS-PRIMARY").count() shouldBeExactly 1.0
        meterRegistry.counter("tracking.ingestion.kafka.published").count() shouldBeExactly 1.0
    }

    private fun rawAisProducer(
        kafkaTemplate: KafkaTemplate<String, String>,
        metrics: IngestionMetrics = IngestionMetrics(SimpleMeterRegistry()),
    ): RawAisProducer {
        return RawAisProducer(
            kafkaTemplate = kafkaTemplate,
            objectMapper = ObjectMapper(),
            topicProperties = KafkaTopicProperties(rawAis = "raw-ais"),
            mmsiRecordKeyStrategy = MmsiRecordKeyStrategy(),
            ingestionMetrics = metrics,
        )
    }

    private fun kafkaTemplateThat(
        onSend: (ProducerRecord<String, String>) -> CompletableFuture<SendResult<String, String>>,
    ): KafkaTemplate<String, String> {
        @Suppress("UNCHECKED_CAST")
        val producerFactory = mock(ProducerFactory::class.java) as ProducerFactory<String, String>
        return object : KafkaTemplate<String, String>(producerFactory) {
            override fun send(record: ProducerRecord<String, String>): CompletableFuture<SendResult<String, String>> = onSend(record)
        }
    }

    private fun validShip(sourceId: String = "AIS-PRIMARY"): CanonicalShip {
        return CanonicalShip(
            mmsi = "574001230",
            lat = 10.7769,
            lon = 106.7009,
            vesselName = "PACIFIC TRADER",
            eventTime = 1708941600000,
            sourceId = sourceId,
        )
    }

    private fun traceContext(): TraceContext {
        return TraceContext(
            requestId = "req-raw-ais-test",
            traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        )
    }
}
