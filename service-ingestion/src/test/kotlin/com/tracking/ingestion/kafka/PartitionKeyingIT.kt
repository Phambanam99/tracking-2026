package com.tracking.ingestion.kafka

import com.tracking.common.dto.CanonicalFlight
import io.kotest.matchers.shouldBe
import kotlin.test.Test

public class PartitionKeyingIT {
    @Test
    public fun `should always use icao as record key`() {
        val strategy = RecordKeyStrategy()
        val flight =
            CanonicalFlight(
                icao = "ICAO123",
                lat = 0.0,
                lon = 0.0,
                eventTime = 1,
                sourceId = "source",
            )

        val key = strategy.keyFor(flight)

        key shouldBe "ICAO123"
    }
}
