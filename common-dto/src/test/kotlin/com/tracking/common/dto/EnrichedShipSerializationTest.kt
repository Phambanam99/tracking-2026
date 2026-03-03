package com.tracking.common.dto

import io.kotest.matchers.shouldBe
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import kotlin.test.Test

public class EnrichedShipSerializationTest {
    private val json: Json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = false
        explicitNulls = false
    }

    @Test
    public fun `should deserialize enriched ship payload with metadata`() {
        val payload =
            """
            {
              "mmsi": "574001230",
              "lat": 10.7769,
              "lon": 106.7009,
              "event_time": 1708941600000,
              "source_id": "ais_primary",
              "is_historical": false,
              "metadata": {
                "flagCountry": "Vietnam",
                "shipTypeName": "Cargo Vessel"
              }
            }
            """.trimIndent()

        val ship = json.decodeFromString<EnrichedShip>(payload)

        ship.mmsi shouldBe "574001230"
        ship.isHistorical shouldBe false
        ship.metadata?.flagCountry shouldBe "Vietnam"
        ship.metadata?.shipTypeName shouldBe "Cargo Vessel"
    }

    @Test
    public fun `should keep optional ship metadata nullable`() {
        val payload =
            """
            {
              "mmsi": "574001230",
              "lat": 10.7769,
              "lon": 106.7009,
              "event_time": 1708941600000,
              "source_id": "ais_primary"
            }
            """.trimIndent()

        val ship = json.decodeFromString<EnrichedShip>(payload)

        ship.metadata shouldBe null
        ship.isHistorical shouldBe false
    }
}
