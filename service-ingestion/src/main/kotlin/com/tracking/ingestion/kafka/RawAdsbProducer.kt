package com.tracking.ingestion.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.CanonicalFlight
import com.tracking.ingestion.api.ProducerUnavailableException
import com.tracking.ingestion.metrics.IngestionMetrics
import com.tracking.ingestion.tracing.TraceContext
import com.tracking.ingestion.tracing.TraceContextExtractor
import java.nio.charset.StandardCharsets
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeoutException
import org.apache.kafka.clients.producer.ProducerRecord
import org.slf4j.LoggerFactory
import org.springframework.kafka.KafkaException
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component
import reactor.core.publisher.Mono
import reactor.core.scheduler.Schedulers

@Component
public class RawAdsbProducer(
    private val kafkaTemplate: KafkaTemplate<String, String>,
    private val objectMapper: ObjectMapper,
    private val topicProperties: KafkaTopicProperties,
    private val recordKeyStrategy: RecordKeyStrategy,
    private val ingestionMetrics: IngestionMetrics,
) {
    private val logger = LoggerFactory.getLogger(RawAdsbProducer::class.java)

    public fun publish(flight: CanonicalFlight, traceContext: TraceContext): Mono<Void> {
        val key = recordKeyStrategy.keyFor(flight)
        return Mono.fromCallable {
            enqueue(flight, traceContext)
            true
        }
            .subscribeOn(Schedulers.boundedElastic())
            .then()
            .onErrorMap { error -> mapToProducerException(error, key) }
    }

    public fun publishBatch(flights: List<CanonicalFlight>, traceContext: TraceContext): Mono<Int> {
        return Mono.fromCallable {
            flights.forEach { flight -> enqueue(flight, traceContext) }
            flights.size
        }
            .subscribeOn(Schedulers.boundedElastic())
            .onErrorMap { error ->
                val key = flights.firstOrNull()?.let(recordKeyStrategy::keyFor) ?: "batch"
                mapToProducerException(error, key)
            }
    }

    public fun flush(): Unit = kafkaTemplate.flush()

    private fun addTraceHeaders(record: ProducerRecord<String, String>, traceContext: TraceContext) {
        traceContext.requestId?.let { requestId ->
            record.headers().add(
                TraceContextExtractor.HEADER_REQUEST_ID,
                requestId.toByteArray(StandardCharsets.UTF_8),
            )
        }
        traceContext.traceparent?.let { traceparent ->
            record.headers().add(
                TraceContextExtractor.HEADER_TRACEPARENT,
                traceparent.toByteArray(StandardCharsets.UTF_8),
            )
        }
    }

    private fun enqueue(flight: CanonicalFlight, traceContext: TraceContext) {
        val key = recordKeyStrategy.keyFor(flight)
        val payload = objectMapper.writeValueAsString(flight)
        val record = ProducerRecord(topicProperties.raw, key, payload)
        addTraceHeaders(record, traceContext)

        try {
            // Accept the HTTP request once the producer buffer accepts the record; broker acks are tracked asynchronously.
            val future = kafkaTemplate.send(record)
            trackPublishResult(future, key)
        } catch (error: Throwable) {
            throw mapToProducerException(error, key)
        }
    }

    private fun trackPublishResult(
        future: CompletableFuture<*>,
        key: String,
    ) {
        future.whenComplete { _, error ->
            if (error == null) {
                ingestionMetrics.incrementPublished(1)
                return@whenComplete
            }

            ingestionMetrics.incrementKafkaPublishFailed()
            logger.warn("Kafka publish completed exceptionally for key={}", key, rootCauseOf(error))
        }
    }

    private fun mapToProducerException(error: Throwable, key: String): Throwable {
        if (error is ProducerUnavailableException) {
            return error
        }

        val rootCause = rootCauseOf(error)
        val message = when {
            rootCause is TimeoutException -> "Kafka publish timeout for key=$key."
            rootCause is KafkaException -> "Kafka publish failed for key=$key: ${rootCause.message}"
            else -> return error
        }
        logger.warn(message, rootCause)
        ingestionMetrics.incrementProducerUnavailable()
        return ProducerUnavailableException(message)
    }

    private fun rootCauseOf(error: Throwable): Throwable {
        var current = error
        while (current.cause != null && current.cause !== current) {
            current = current.cause!!
        }
        return current
    }
}
