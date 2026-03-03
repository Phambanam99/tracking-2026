package com.tracking.processing.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.tracking.common.dto.CanonicalShip
import com.tracking.processing.engine.ShipProcessingResult
import com.tracking.processing.engine.ShipProcessingStatus
import com.tracking.processing.engine.ShipProcessor
import com.tracking.processing.metrics.ProcessingMetrics
import com.tracking.processing.tracing.ProcessingTraceContext
import com.tracking.processing.tracing.ProcessingTraceHeaders
import com.tracking.processing.tracing.TraceContextHolder
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import java.nio.charset.StandardCharsets
import org.apache.kafka.clients.consumer.ConsumerRecord
import kotlin.test.Test

public class RawAisConsumerTest {
    private val objectMapper: ObjectMapper = jacksonObjectMapper()

    @Test
    public fun `should process ship record when key matches mmsi`() {
        val processor = RecordingShipProcessor()
        val dlq = RecordingShipDlqProducer()
        val consumer = RawAisConsumer(
            objectMapper = objectMapper,
            shipProcessor = processor,
            invalidRecordDlqProducer = dlq,
            processingMetrics = ProcessingMetrics(io.micrometer.core.instrument.simple.SimpleMeterRegistry()),
            strictKeyMatch = true,
        )
        val ship = ship(mmsi = "574001230")

        consumer.consume("574001230", objectMapper.writeValueAsString(ship))

        processor.processed shouldHaveSize 1
        dlq.records shouldHaveSize 0
    }

    @Test
    public fun `should reject ship key mismatch to dlq when strict mode enabled`() {
        val processor = RecordingShipProcessor()
        val dlq = RecordingShipDlqProducer()
        val consumer = RawAisConsumer(
            objectMapper = objectMapper,
            shipProcessor = processor,
            invalidRecordDlqProducer = dlq,
            processingMetrics = ProcessingMetrics(io.micrometer.core.instrument.simple.SimpleMeterRegistry()),
            strictKeyMatch = true,
        )
        val ship = ship(mmsi = "574001230")

        consumer.consume("OTHER", objectMapper.writeValueAsString(ship))

        processor.processed shouldHaveSize 0
        dlq.records shouldHaveSize 1
        dlq.records.first().reason shouldBe "KEY_MMSI_MISMATCH"
    }

    @Test
    public fun `should ignore malformed ship payload`() {
        val processor = RecordingShipProcessor()
        val dlq = RecordingShipDlqProducer()
        val consumer = RawAisConsumer(
            objectMapper = objectMapper,
            shipProcessor = processor,
            invalidRecordDlqProducer = dlq,
            processingMetrics = ProcessingMetrics(io.micrometer.core.instrument.simple.SimpleMeterRegistry()),
            strictKeyMatch = true,
        )

        consumer.consume("574001230", """{"mmsi":123}""")

        processor.processed shouldHaveSize 0
        dlq.records shouldHaveSize 0
    }

    @Test
    public fun `should extract trace headers from raw ais kafka record and clear context after processing`() {
        val processor = RecordingShipProcessor()
        val dlq = RecordingShipDlqProducer()
        val consumer = RawAisConsumer(
            objectMapper = objectMapper,
            shipProcessor = processor,
            invalidRecordDlqProducer = dlq,
            processingMetrics = ProcessingMetrics(io.micrometer.core.instrument.simple.SimpleMeterRegistry()),
            strictKeyMatch = true,
        )
        val ship = ship(mmsi = "574001230")
        val payload = objectMapper.writeValueAsString(ship)
        val record = ConsumerRecord("raw-ais", 0, 0L, "574001230", payload)
        record.headers().add(ProcessingTraceHeaders.REQUEST_ID, "req-raw-ais-consumer-1".toByteArray(StandardCharsets.UTF_8))
        record.headers().add(
            ProcessingTraceHeaders.TRACEPARENT,
            "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01".toByteArray(StandardCharsets.UTF_8),
        )

        consumer.consume(record)

        processor.processed shouldHaveSize 1
        processor.traceContexts shouldHaveSize 1
        processor.traceContexts.first()?.requestId shouldBe "req-raw-ais-consumer-1"
        TraceContextHolder.current().shouldBeNull()
    }

    private fun ship(mmsi: String): CanonicalShip =
        CanonicalShip(
            mmsi = mmsi,
            lat = 10.7769,
            lon = 106.7009,
            eventTime = 1_700_000_000_000,
            sourceId = "ais-1",
        )

    private class RecordingShipProcessor : ShipProcessor {
        val processed: MutableList<CanonicalShip> = mutableListOf()
        val traceContexts: MutableList<ProcessingTraceContext?> = mutableListOf()

        override fun process(ship: CanonicalShip): ShipProcessingResult {
            processed.add(ship)
            traceContexts.add(TraceContextHolder.current())
            return ShipProcessingResult(status = ShipProcessingStatus.PUBLISHED)
        }
    }

    private class RecordingShipDlqProducer : ShipInvalidRecordDlqProducer {
        val records: MutableList<InvalidShipRecord> = mutableListOf()

        override fun publish(record: InvalidShipRecord) {
            records.add(record)
        }
    }
}
