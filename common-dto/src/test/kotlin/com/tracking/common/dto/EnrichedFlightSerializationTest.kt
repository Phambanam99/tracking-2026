package com.tracking.common.dto

import io.kotest.matchers.shouldBe
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import kotlin.test.Test

public class EnrichedFlightSerializationTest {
    private val json: Json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = false
        explicitNulls = false
    }

    @Test
    public fun `should deserialize enriched payload with metadata`() {
        val payload =
            """
            {
              "icao": "888123",
              "lat": 21.0285,
              "lon": 105.8542,
              "event_time": 1708941600000,
              "source_id": "crawler_hn_1",
              "is_historical": false,
              "metadata": {
                "registration": "VN-A123",
                "aircraftType": "A321",
                "operator": "Vietnam Airlines",
                "countryCode": "VN"
              }
            }
            """.trimIndent()

        val enriched = json.decodeFromString<EnrichedFlight>(payload)

        enriched.icao shouldBe "888123"
        enriched.isHistorical shouldBe false
        enriched.metadata?.registration shouldBe "VN-A123"
        enriched.metadata?.countryCode shouldBe "VN"
    }

    @Test
    public fun `should keep optional metadata nullable`() {
        val payload =
            """
            {
              "icao": "888123",
              "lat": 21.0285,
              "lon": 105.8542,
              "event_time": 1708941600000,
              "source_id": "crawler_hn_1"
            }
            """.trimIndent()

        val enriched = json.decodeFromString<EnrichedFlight>(payload)

        enriched.metadata shouldBe null
        enriched.isHistorical shouldBe false
    }
}
