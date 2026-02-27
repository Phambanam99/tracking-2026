package com.tracking.processing.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.tracking.common.dto.CanonicalFlight
import com.tracking.processing.engine.FlightProcessor
import com.tracking.processing.engine.ProcessingResult
import com.tracking.processing.engine.ProcessingStatus
import com.tracking.processing.metrics.ProcessingMetrics
import com.tracking.processing.tracing.ProcessingTraceHeaders
import com.tracking.processing.tracing.TraceContextHolder
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import java.nio.charset.StandardCharsets
import org.apache.kafka.clients.consumer.ConsumerRecord
import kotlin.test.Test

public class RawAdsbConsumerTest {
    private val objectMapper: ObjectMapper = jacksonObjectMapper()

    @Test
    public fun `should process record when key matches icao`() {
        val processor = RecordingFlightProcessor()
        val dlq = RecordingDlqProducer()
        val consumer = RawAdsbConsumer(
            objectMapper = objectMapper,
            flightProcessor = processor,
            invalidRecordDlqProducer = dlq,
            processingMetrics = ProcessingMetrics(SimpleMeterRegistry()),
            strictKeyMatch = true,
        )
        val flight = flight(icao = "ABC123")

        consumer.consume("ABC123", objectMapper.writeValueAsString(flight))

        processor.processed shouldHaveSize 1
        dlq.records shouldHaveSize 0
    }

    @Test
    public fun `should reject key mismatch to dlq when strict mode enabled`() {
        val processor = RecordingFlightProcessor()
        val dlq = RecordingDlqProducer()
        val consumer = RawAdsbConsumer(
            objectMapper = objectMapper,
            flightProcessor = processor,
            invalidRecordDlqProducer = dlq,
            processingMetrics = ProcessingMetrics(SimpleMeterRegistry()),
            strictKeyMatch = true,
        )
        val flight = flight(icao = "ABC123")

        consumer.consume("OTHER", objectMapper.writeValueAsString(flight))

        processor.processed shouldHaveSize 0
        dlq.records shouldHaveSize 1
        dlq.records.first().reason shouldBe "KEY_ICAO_MISMATCH"
    }

    @Test
    public fun `should ignore malformed payload`() {
        val processor = RecordingFlightProcessor()
        val dlq = RecordingDlqProducer()
        val consumer = RawAdsbConsumer(
            objectMapper = objectMapper,
            flightProcessor = processor,
            invalidRecordDlqProducer = dlq,
            processingMetrics = ProcessingMetrics(SimpleMeterRegistry()),
            strictKeyMatch = true,
        )

        consumer.consume("ABC123", """{"icao":123}""")

        processor.processed shouldHaveSize 0
        dlq.records shouldHaveSize 0
    }

    @Test
    public fun `should extract trace headers from kafka record and clear context after processing`() {
        val processor = RecordingFlightProcessor()
        val dlq = RecordingDlqProducer()
        val consumer = RawAdsbConsumer(
            objectMapper = objectMapper,
            flightProcessor = processor,
            invalidRecordDlqProducer = dlq,
            processingMetrics = ProcessingMetrics(SimpleMeterRegistry()),
            strictKeyMatch = true,
        )
        val flight = flight(icao = "ABC123")
        val payload = objectMapper.writeValueAsString(flight)
        val record = ConsumerRecord("raw-adsb", 0, 0L, "ABC123", payload)
        record.headers().add(ProcessingTraceHeaders.REQUEST_ID, "req-raw-consumer-1".toByteArray(StandardCharsets.UTF_8))
        record.headers().add(
            ProcessingTraceHeaders.TRACEPARENT,
            "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01".toByteArray(StandardCharsets.UTF_8),
        )

        consumer.consume(record)

        processor.processed shouldHaveSize 1
        processor.traceContexts shouldHaveSize 1
        processor.traceContexts.first()?.requestId shouldBe "req-raw-consumer-1"
        processor.traceContexts.first()?.traceparent shouldBe
            "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
        TraceContextHolder.current().shouldBeNull()
    }

    private fun flight(icao: String): CanonicalFlight =
        CanonicalFlight(
            icao = icao,
            lat = 21.0,
            lon = 105.0,
            eventTime = 1_700_000_000_000,
            sourceId = "radar-1",
        )

    private class RecordingFlightProcessor : FlightProcessor {
        val processed: MutableList<CanonicalFlight> = mutableListOf()
        val traceContexts: MutableList<com.tracking.processing.tracing.ProcessingTraceContext?> = mutableListOf()

        override fun process(flight: CanonicalFlight): ProcessingResult {
            processed.add(flight)
            traceContexts.add(TraceContextHolder.current())
            return ProcessingResult(status = ProcessingStatus.PUBLISHED)
        }
    }

    private class RecordingDlqProducer : InvalidRecordDlqProducer {
        val records: MutableList<InvalidFlightRecord> = mutableListOf()

        override fun publish(record: InvalidFlightRecord) {
            records.add(record)
        }
    }
}
