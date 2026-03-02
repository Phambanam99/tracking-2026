package com.tracking.processing.enrich

import com.tracking.common.dto.AircraftMetadata
import io.kotest.matchers.shouldBe
import java.time.Duration
import java.time.Instant
import kotlin.test.Test

public class ReferenceDataCacheTest {
    @Test
    public fun `should serve lookups from memory and refresh only after interval`() {
        val snapshots =
            listOf(
                mapOf("ABC123" to AircraftMetadata(operator = "FirstAir")),
                mapOf("ABC123" to AircraftMetadata(operator = "SecondAir")),
            )
        var loadCount = 0
        var now = Instant.parse("2026-01-01T00:00:00Z")
        val loader =
            ReferenceDataLoader {
                snapshots[loadCount++]
            }

        val cache =
            ReferenceDataCache(
                loader = loader,
                refreshInterval = Duration.ofMinutes(10),
                nowProvider = { now },
            )

        val first = cache.findByIcao("ABC123")
        val second = cache.findByIcao("ABC123")

        loadCount shouldBe 1
        first?.operator shouldBe "FirstAir"
        second?.operator shouldBe "FirstAir"

        now = now.plus(Duration.ofMinutes(11))
        val third = cache.findByIcao("ABC123")

        loadCount shouldBe 2
        third?.operator shouldBe "SecondAir"
    }

    @Test
    public fun `should normalize icao lookups to uppercase`() {
        val cache =
            ReferenceDataCache(
                loader = ReferenceDataLoader { mapOf("ABC123" to AircraftMetadata(aircraftType = "A320")) },
                refreshInterval = Duration.ofMinutes(10),
            )

        val result = cache.findByIcao(" abc123 ")

        result?.aircraftType shouldBe "A320"
    }
}
