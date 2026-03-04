package com.tracking.processing.enrich

import com.tracking.common.dto.CanonicalShip
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import kotlin.test.Test

public class ShipEnricherTest {

    private val enricher = ShipEnricher()

    private fun ship(
            mmsi: String,
            vesselType: String? = null,
    ): CanonicalShip =
            CanonicalShip(
                    mmsi = mmsi,
                    lat = 10.0,
                    lon = 107.0,
                    eventTime = 1_000L,
                    sourceId = "test-source",
                    vesselType = vesselType,
            )

    @Test
    public fun `should enrich with flag country and flag url from Viet Nam MMSI`() {
        val result = enricher.enrich(ship("574123456"), isHistorical = false)

        result.metadata?.flagCountry shouldBe "Viet Nam"
        result.metadata?.flagUrl shouldBe "https://flagcdn.com/h80/vn.png"
    }

    @Test
    public fun `should enrich with ship type name when vesselType is present`() {
        val result = enricher.enrich(ship("574123456", vesselType = "cargo"), isHistorical = false)

        result.metadata?.shipTypeName shouldBe "Cargo"
    }

    @Test
    public fun `should return metadata even when vesselType is null`() {
        val result = enricher.enrich(ship("574123456", vesselType = null), isHistorical = false)

        // Previously returned null metadata; now always has metadata
        result.metadata.shouldNotBeNull()
        result.metadata?.flagCountry shouldBe "Viet Nam"
        result.metadata?.shipTypeName shouldBe null
    }

    @Test
    public fun `should return metadata with null flag when MMSI has unknown MID`() {
        val result = enricher.enrich(ship("999000000"), isHistorical = false)

        result.metadata.shouldNotBeNull()
        result.metadata?.flagCountry shouldBe null
        result.metadata?.flagUrl shouldBe null
    }

    @Test
    public fun `should set isHistorical flag correctly`() {
        val live = enricher.enrich(ship("574123456"), isHistorical = false)
        val historical = enricher.enrich(ship("574123456"), isHistorical = true)

        live.isHistorical shouldBe false
        historical.isHistorical shouldBe true
    }

    @Test
    public fun `should enrich Panama flagged ship`() {
        val result = enricher.enrich(ship("351000001"), isHistorical = false)

        result.metadata?.flagCountry shouldBe "Panama"
        result.metadata?.flagUrl shouldBe "https://flagcdn.com/h80/pa.png"
    }
}
