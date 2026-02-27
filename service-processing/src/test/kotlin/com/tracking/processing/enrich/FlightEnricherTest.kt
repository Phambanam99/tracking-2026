package com.tracking.processing.enrich

import com.tracking.common.dto.AircraftMetadata
import com.tracking.common.dto.CanonicalFlight
import io.kotest.matchers.shouldBe
import java.time.Duration
import kotlin.test.Test

public class FlightEnricherTest {
    @Test
    public fun `should enrich canonical flight with cached metadata and historical flag`() {
        val cache =
            ReferenceDataCache(
                loader = ReferenceDataLoader { mapOf("ABC123" to AircraftMetadata(operator = "TestAir")) },
                refreshInterval = Duration.ofMinutes(10),
            )
        val enricher =
            FlightEnricher(
                referenceDataCache = cache,
                icaoCountryResolver = IcaoCountryResolver(),
                aircraftPhotoProvider = AircraftPhotoProvider { null },
            )
        val flight =
            CanonicalFlight(
                icao = "ABC123",
                lat = 21.0,
                lon = 105.0,
                eventTime = 1_000L,
                sourceId = "radar-1",
            )

        val enriched = enricher.enrich(flight, isHistorical = true)

        enriched.icao shouldBe "ABC123"
        enriched.isHistorical shouldBe true
        enriched.metadata?.operator shouldBe "TestAir"
    }

    @Test
    public fun `should enrich missing country and image fields from icao resolver`() {
        val cache =
            ReferenceDataCache(
                loader = ReferenceDataLoader { mapOf("888001" to AircraftMetadata(operator = "RadarX")) },
                refreshInterval = Duration.ofMinutes(10),
            )
        val enricher =
            FlightEnricher(
                referenceDataCache = cache,
                icaoCountryResolver = IcaoCountryResolver(imageUrlTemplate = "https://img/{icao}.jpg"),
                aircraftPhotoProvider = AircraftPhotoProvider { "https://api.photo/888001.jpg" },
            )
        val flight =
            CanonicalFlight(
                icao = "888001",
                lat = 21.0,
                lon = 105.0,
                eventTime = 2_000L,
                sourceId = "radar-2",
            )

        val enriched = enricher.enrich(flight, isHistorical = false)

        enriched.metadata?.countryCode shouldBe "VN"
        enriched.metadata?.countryFlagUrl shouldBe "https://flagcdn.com/h80/vn.png"
        enriched.metadata?.imageUrl shouldBe "https://api.photo/888001.jpg"
    }
}
