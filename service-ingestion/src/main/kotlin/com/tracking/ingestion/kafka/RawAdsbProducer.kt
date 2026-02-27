package com.tracking.ingestion.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.CanonicalFlight
import com.tracking.ingestion.api.ProducerUnavailableException
import com.tracking.ingestion.metrics.IngestionMetrics
import com.tracking.ingestion.tracing.TraceContext
import com.tracking.ingestion.tracing.TraceContextExtractor
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.util.concurrent.TimeoutException
import kotlin.math.max
import org.apache.kafka.clients.producer.ProducerRecord
import org.slf4j.LoggerFactory
import org.springframework.kafka.KafkaException
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component
import reactor.core.publisher.Flux
import reactor.core.publisher.Mono

@Component
public class RawAdsbProducer(
    private val kafkaTemplate: KafkaTemplate<String, String>,
    private val objectMapper: ObjectMapper,
    private val topicProperties: KafkaTopicProperties,
    private val recordKeyStrategy: RecordKeyStrategy,
    private val producerProperties: IngestionKafkaProperties,
    private val ingestionMetrics: IngestionMetrics,
) {
    private val logger = LoggerFactory.getLogger(RawAdsbProducer::class.java)

    public fun publish(flight: CanonicalFlight, traceContext: TraceContext): Mono<Void> {
        val key = recordKeyStrategy.keyFor(flight)
        return Mono.defer {
            val payload = objectMapper.writeValueAsString(flight)
            val record = ProducerRecord(topicProperties.raw, key, payload)
            addTraceHeaders(record, traceContext)
            Mono.fromFuture(kafkaTemplate.send(record))
        }
            .timeout(Duration.ofMillis(producerProperties.publishTimeoutMillis))
            .doOnSuccess {
                ingestionMetrics.incrementPublished(1)
            }
            .then()
            .onErrorMap { error -> mapToProducerException(error, key) }
    }

    public fun publishBatch(flights: List<CanonicalFlight>, traceContext: TraceContext): Mono<Int> {
        val concurrency = max(1, producerProperties.batchPublishConcurrency)
        return Flux.fromIterable(flights)
            .flatMap({ flight -> publish(flight, traceContext).thenReturn(1) }, concurrency)
            .reduce(0, Int::plus)
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
