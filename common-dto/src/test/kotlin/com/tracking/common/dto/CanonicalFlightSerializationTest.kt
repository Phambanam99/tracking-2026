package com.tracking.common.dto

import io.kotest.matchers.shouldBe
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.test.Test

public class CanonicalFlightSerializationTest {
    private val json: Json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = false
        explicitNulls = false
    }

    @Test
    public fun `should deserialize canonical payload with snake_case keys`() {
        val payload =
            """
            {
              "icao": "888123",
              "lat": 21.0285,
              "lon": 105.8542,
              "altitude": 32000,
              "speed": 850.5,
              "heading": 45.0,
              "event_time": 1708941600000,
              "source_id": "crawler_hn_1"
            }
            """.trimIndent()

        val flight = json.decodeFromString<CanonicalFlight>(payload)

        flight.icao shouldBe "888123"
        flight.lat shouldBe 21.0285
        flight.lon shouldBe 105.8542
        flight.altitude shouldBe 32000
        flight.speed shouldBe 850.5
        flight.heading shouldBe 45.0
        flight.eventTime shouldBe 1708941600000
        flight.sourceId shouldBe "crawler_hn_1"
    }

    @Test
    public fun `should serialize canonical payload with contract keys`() {
        val flight =
            CanonicalFlight(
                icao = "888123",
                lat = 21.0285,
                lon = 105.8542,
                eventTime = 1708941600000,
                sourceId = "crawler_hn_1",
            )

        val serialized = json.encodeToString(flight)

        serialized.contains("\"event_time\":1708941600000") shouldBe true
        serialized.contains("\"source_id\":\"crawler_hn_1\"") shouldBe true
    }
}
