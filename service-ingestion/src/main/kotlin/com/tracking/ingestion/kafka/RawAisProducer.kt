package com.tracking.ingestion.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.CanonicalShip
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
public class RawAisProducer(
    private val kafkaTemplate: KafkaTemplate<String, String>,
    private val objectMapper: ObjectMapper,
    private val topicProperties: KafkaTopicProperties,
    private val mmsiRecordKeyStrategy: MmsiRecordKeyStrategy,
    private val ingestionMetrics: IngestionMetrics,
) {
    private val logger = LoggerFactory.getLogger(RawAisProducer::class.java)

    public fun publish(ship: CanonicalShip, traceContext: TraceContext): Mono<Void> {
        val key = mmsiRecordKeyStrategy.keyFor(ship)
        return Mono.fromCallable {
            enqueue(ship, traceContext)
            true
        }
            .subscribeOn(Schedulers.boundedElastic())
            .then()
            .onErrorMap { error -> mapToProducerException(error, key) }
    }

    public fun publishBatch(ships: List<CanonicalShip>, traceContext: TraceContext): Mono<Int> {
        return Mono.fromCallable {
            ships.forEach { ship -> enqueue(ship, traceContext) }
            ships.size
        }
            .subscribeOn(Schedulers.boundedElastic())
            .onErrorMap { error ->
                val key = ships.firstOrNull()?.let(mmsiRecordKeyStrategy::keyFor) ?: "batch"
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

    private fun enqueue(ship: CanonicalShip, traceContext: TraceContext) {
        val key = mmsiRecordKeyStrategy.keyFor(ship)
        val payload = objectMapper.writeValueAsString(ship)
        val record = ProducerRecord(topicProperties.rawAis, key, payload)
        addTraceHeaders(record, traceContext)

        try {
            val future = kafkaTemplate.send(record)
            trackPublishResult(future, key, ship.sourceId)
        } catch (error: Throwable) {
            throw mapToProducerException(error, key)
        }
    }

    private fun trackPublishResult(
        future: CompletableFuture<*>,
        key: String,
        sourceId: String,
    ) {
        future.whenComplete { _, error ->
            if (error == null) {
                ingestionMetrics.incrementPublished(sourceId)
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
