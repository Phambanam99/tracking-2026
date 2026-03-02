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
                icaoCountryResolver = IcaoCountryResolver(imageUrlTemplate = ""),
                militaryHexResolver = MilitaryHexResolver(emptySet()),
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
    public fun `should enrich missing country field from icao resolver without generating image url`() {
        val cache =
            ReferenceDataCache(
                loader = ReferenceDataLoader { mapOf("888001" to AircraftMetadata(operator = "RadarX")) },
                refreshInterval = Duration.ofMinutes(10),
            )
        val enricher =
            FlightEnricher(
                referenceDataCache = cache,
                icaoCountryResolver = IcaoCountryResolver(imageUrlTemplate = ""),
                militaryHexResolver = MilitaryHexResolver(emptySet()),
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
        enriched.metadata?.imageUrl shouldBe null
    }

    @Test
    public fun `should preserve cached aircraft type and fill registration and country fallback together`() {
        val cache =
            ReferenceDataCache(
                loader = ReferenceDataLoader {
                    mapOf(
                        "A00001" to
                            AircraftMetadata(
                                aircraftType = "A321",
                                operator = "Vietnam Airlines",
                            ),
                    )
                },
                refreshInterval = Duration.ofMinutes(10),
            )
        val enricher =
            FlightEnricher(
                referenceDataCache = cache,
                icaoCountryResolver = IcaoCountryResolver(),
                militaryHexResolver = MilitaryHexResolver(emptySet()),
            )
        val flight =
            CanonicalFlight(
                icao = "A00001",
                lat = 21.0,
                lon = 105.0,
                eventTime = 3_000L,
                sourceId = "adsbx-1",
            )

        val enriched = enricher.enrich(flight, isHistorical = false)

        enriched.metadata?.registration shouldBe "N1"
        enriched.metadata?.aircraftType shouldBe "A321"
        enriched.metadata?.operator shouldBe "Vietnam Airlines"
        enriched.metadata?.countryCode shouldBe "US"
        enriched.metadata?.countryFlagUrl shouldBe "https://flagcdn.com/h80/us.png"
    }

    @Test
    public fun `should fallback to source aircraft type when cache is empty`() {
        val cache =
            ReferenceDataCache(
                loader = ReferenceDataLoader { emptyMap() },
                refreshInterval = Duration.ofMinutes(10),
            )
        val enricher =
            FlightEnricher(
                referenceDataCache = cache,
                icaoCountryResolver = IcaoCountryResolver(),
                militaryHexResolver = MilitaryHexResolver(emptySet()),
            )
        val flight =
            CanonicalFlight(
                icao = "A00004",
                lat = 21.0,
                lon = 105.0,
                aircraftType = "B738",
                eventTime = 4_000L,
                sourceId = "radarbox-1",
            )

        val enriched = enricher.enrich(flight, isHistorical = false)

        enriched.metadata?.aircraftType shouldBe "B738"
    }

    @Test
    public fun `should keep metadata when aircraft is military even without other enrichment fields`() {
        val cache =
            ReferenceDataCache(
                loader = ReferenceDataLoader { emptyMap() },
                refreshInterval = Duration.ofMinutes(10),
            )
        val enricher =
            FlightEnricher(
                referenceDataCache = cache,
                icaoCountryResolver = IcaoCountryResolver(imageUrlTemplate = ""),
                militaryHexResolver = MilitaryHexResolver(setOf("ae292b")),
            )
        val flight =
            CanonicalFlight(
                icao = "AE292B",
                lat = 21.0,
                lon = 105.0,
                eventTime = 5_000L,
                sourceId = "adsbx-2",
            )

        val enriched = enricher.enrich(flight, isHistorical = false)

        enriched.metadata?.isMilitary shouldBe true
    }
}
