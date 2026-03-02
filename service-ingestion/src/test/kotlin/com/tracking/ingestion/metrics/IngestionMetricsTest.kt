package com.tracking.ingestion.metrics

import com.tracking.common.dto.CanonicalFlight
import io.kotest.matchers.doubles.shouldBeExactly
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import org.junit.jupiter.api.Test

public class IngestionMetricsTest {
    @Test
    public fun `should record accepted records by source id`() {
        val meterRegistry = SimpleMeterRegistry()
        val metrics = IngestionMetrics(meterRegistry)

        metrics.incrementAcceptedSingle("ADSB-HCKT")
        metrics.incrementAcceptedBatch(
            listOf(
                flight(sourceId = "ADSB-HCKT"),
                flight(icao = "ICAO124", sourceId = "ADSB-HCKT"),
                flight(icao = "ICAO125", sourceId = "RADARBOX-GLOBAL"),
            ),
        )

        meterRegistry.counter("tracking.ingestion.accepted.records", "source_id", "ADSB-HCKT").count() shouldBeExactly 3.0
        meterRegistry.counter("tracking.ingestion.accepted.records", "source_id", "RADARBOX-GLOBAL").count() shouldBeExactly 1.0
    }

    @Test
    public fun `should record published records by source id`() {
        val meterRegistry = SimpleMeterRegistry()
        val metrics = IngestionMetrics(meterRegistry)

        metrics.incrementPublished("ADSB-HCKT")
        metrics.incrementPublished("ADSB-HCKT")
        metrics.incrementPublished("FR24-GLOBAL")

        meterRegistry.counter("tracking.ingestion.kafka.published.records", "source_id", "ADSB-HCKT").count() shouldBeExactly 2.0
        meterRegistry.counter("tracking.ingestion.kafka.published.records", "source_id", "FR24-GLOBAL").count() shouldBeExactly 1.0
    }

    private fun flight(
        icao: String = "ICAO123",
        sourceId: String,
    ): CanonicalFlight =
        CanonicalFlight(
            icao = icao,
            lat = 10.5,
            lon = 106.7,
            eventTime = 1708941600000,
            sourceId = sourceId,
        )
}
