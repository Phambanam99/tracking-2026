package com.tracking.broadcaster.ws

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.tracking.common.dto.AircraftMetadata
import com.tracking.common.dto.EnrichedFlight
import com.tracking.common.dto.LiveFlightMessage
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import kotlin.test.Test

public class LiveFlightMessageSerializationTest {
    private val objectMapper = jacksonObjectMapper()

    @Test
    public fun `should serialize websocket payload using snake_case contract keys`() {
        val payload = objectMapper.writeValueAsString(
            LiveFlightMessage(
                sentAt = 1_700_000_000_123,
                flight = EnrichedFlight(
                    icao = "ICAO123",
                    lat = 21.0,
                    lon = 105.5,
                    eventTime = 1_700_000_000_000,
                    sourceId = "radar-1",
                    metadata = AircraftMetadata(
                        registration = "VN-A321",
                        aircraftType = "A321",
                        operator = "Vietnam Airlines",
                        countryCode = "VN",
                    ),
                ),
            ),
        )

        payload shouldContain "\"sent_at\":1700000000123"
        payload shouldContain "\"event_time\":1700000000000"
        payload shouldContain "\"source_id\":\"radar-1\""
        payload shouldContain "\"aircraft_type\":\"A321\""
        payload shouldContain "\"country_code\":\"VN\""
        payload shouldNotContain "\"sentAt\""
        payload shouldNotContain "\"eventTime\""
        payload shouldNotContain "\"sourceId\""
        payload shouldNotContain "\"aircraftType\""
        payload shouldNotContain "\"countryCode\""

        val root = objectMapper.readTree(payload)
        root.get("sent_at").asLong() shouldBe 1_700_000_000_123
        root.get("flight").get("event_time").asLong() shouldBe 1_700_000_000_000
        root.get("flight").get("source_id").asText() shouldBe "radar-1"
        root.get("flight").get("metadata").get("country_code").asText() shouldBe "VN"
    }
}
