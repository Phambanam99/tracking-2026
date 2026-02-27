package com.tracking.common.dto

import io.kotest.matchers.shouldBe
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.test.Test

public class ContractCompatibilityTest {
    private val json: Json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = false
        explicitNulls = false
    }

    @Test
    public fun `should ignore unknown fields for backward compatibility`() {
        val payload =
            """
            {
              "icao": "888123",
              "lat": 21.0285,
              "lon": 105.8542,
              "event_time": 1708941600000,
              "source_id": "crawler_hn_1",
              "new_field_from_future": "ignore_me"
            }
            """.trimIndent()

        val flight = json.decodeFromString<CanonicalFlight>(payload)

        flight.icao shouldBe "888123"
        flight.sourceId shouldBe "crawler_hn_1"
    }

    @Test
    public fun `should preserve required contract fields during serialize`() {
        val flight =
            CanonicalFlight(
                icao = "ABC999",
                lat = 10.0,
                lon = 20.0,
                eventTime = 1_708_941_600_000,
                sourceId = "crawler_x",
            )

        val serialized = json.encodeToString(flight)

        serialized.contains("\"icao\":\"ABC999\"") shouldBe true
        serialized.contains("\"event_time\":1708941600000") shouldBe true
        serialized.contains("\"source_id\":\"crawler_x\"") shouldBe true
    }
}
