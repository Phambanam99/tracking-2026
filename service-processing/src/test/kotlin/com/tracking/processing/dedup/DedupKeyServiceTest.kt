package com.tracking.processing.dedup

import com.tracking.common.dto.CanonicalFlight
import io.kotest.matchers.shouldBe
import kotlin.test.Test

public class DedupKeyServiceTest {
    @Test
    public fun `should build stable dedup key from canonical fields`() {
        val service = DedupKeyService()
        val flight =
            CanonicalFlight(
                icao = "ABC123",
                lat = 21.0,
                lon = 105.0,
                eventTime = 1_700_000_000_000,
                sourceId = "crawler-1",
            )

        val key = service.keyFor(flight)

        key shouldBe "ABC123_21.0_105.0_1700000000000"
    }
}
