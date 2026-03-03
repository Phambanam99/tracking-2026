package com.tracking.common.dto

import io.kotest.matchers.shouldBe
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.test.Test

public class CanonicalShipSerializationTest {
    private val json: Json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = false
        explicitNulls = false
    }

    @Test
    public fun `should deserialize canonical ship payload with snake_case keys`() {
        val payload =
            """
            {
              "mmsi": "574001230",
              "lat": 10.7769,
              "lon": 106.7009,
              "speed": 12.4,
              "course": 182.5,
              "heading": 180.0,
              "nav_status": "under_way_using_engine",
              "vessel_name": "PACIFIC TRADER",
              "vessel_type": "cargo",
              "call_sign": "3WAB2",
              "event_time": 1708941600000,
              "source_id": "ais_primary"
            }
            """.trimIndent()

        val ship = json.decodeFromString<CanonicalShip>(payload)

        ship.mmsi shouldBe "574001230"
        ship.course shouldBe 182.5
        ship.navStatus shouldBe "under_way_using_engine"
        ship.vesselName shouldBe "PACIFIC TRADER"
        ship.callSign shouldBe "3WAB2"
        ship.sourceId shouldBe "ais_primary"
    }

    @Test
    public fun `should serialize canonical ship payload with contract keys`() {
        val ship =
            CanonicalShip(
                mmsi = "574001230",
                lat = 10.7769,
                lon = 106.7009,
                eventTime = 1708941600000,
                sourceId = "ais_primary",
                vesselName = "PACIFIC TRADER",
            )

        val serialized = json.encodeToString(ship)

        serialized.contains("\"event_time\":1708941600000") shouldBe true
        serialized.contains("\"source_id\":\"ais_primary\"") shouldBe true
        serialized.contains("\"vessel_name\":\"PACIFIC TRADER\"") shouldBe true
    }
}
