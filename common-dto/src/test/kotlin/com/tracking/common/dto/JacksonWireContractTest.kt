package com.tracking.common.dto

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import kotlin.test.Test

public class JacksonWireContractTest {
    private val objectMapper = jacksonObjectMapper()

    @Test
    public fun `should serialize canonical flight with snake_case wire keys`() {
        val payload = objectMapper.writeValueAsString(
            CanonicalFlight(
                icao = "ABC123",
                lat = 21.0285,
                lon = 105.8542,
                aircraftType = "A321",
                eventTime = 1_708_941_600_000,
                sourceId = "crawler_hn_1",
            ),
        )

        payload shouldContain "\"aircraft_type\":\"A321\""
        payload shouldContain "\"event_time\":1708941600000"
        payload shouldContain "\"source_id\":\"crawler_hn_1\""
        payload shouldNotContain "\"aircraftType\""
        payload shouldNotContain "\"eventTime\""
        payload shouldNotContain "\"sourceId\""
    }

    @Test
    public fun `should deserialize canonical flight from camelCase fallback`() {
        val flight = objectMapper.readValue(
            """
            {
              "icao": "ABC123",
              "lat": 21.0285,
              "lon": 105.8542,
              "aircraftType": "A321",
              "eventTime": 1708941600000,
              "sourceId": "crawler_hn_1"
            }
            """.trimIndent(),
            CanonicalFlight::class.java,
        )

        flight.aircraftType shouldBe "A321"
        flight.eventTime shouldBe 1_708_941_600_000
        flight.sourceId shouldBe "crawler_hn_1"
    }

    @Test
    public fun `should serialize enriched flight and websocket envelope with snake_case wire keys`() {
        val payload = objectMapper.writeValueAsString(
            LiveFlightMessage(
                sentAt = 1_700_000_000_123,
                flight = EnrichedFlight(
                    icao = "ICAO123",
                    lat = 21.0,
                    lon = 105.5,
                    eventTime = 1_700_000_000_000,
                    sourceId = "radar-1",
                    isHistorical = false,
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
        payload shouldContain "\"is_historical\":false"
        payload shouldContain "\"aircraft_type\":\"A321\""
        payload shouldContain "\"country_code\":\"VN\""
        payload shouldNotContain "\"sentAt\""
        payload shouldNotContain "\"eventTime\""
        payload shouldNotContain "\"sourceId\""
        payload shouldNotContain "\"isHistorical\""
        payload shouldNotContain "\"aircraftType\""
        payload shouldNotContain "\"countryCode\""
    }

    @Test
    public fun `should deserialize metadata from camelCase fallback`() {
        val flight = objectMapper.readValue(
            """
            {
              "icao": "ICAO123",
              "lat": 21.0,
              "lon": 105.5,
              "event_time": 1700000000000,
              "source_id": "radar-1",
              "is_historical": false,
              "metadata": {
                "registration": "VN-A321",
                "aircraftType": "A321",
                "operator": "Vietnam Airlines",
                "countryCode": "VN",
                "countryFlagUrl": "https://flagcdn.com/h80/vn.png",
                "imageUrl": "https://images.example/A321.jpg"
              }
            }
            """.trimIndent(),
            EnrichedFlight::class.java,
        )

        flight.metadata?.aircraftType shouldBe "A321"
        flight.metadata?.countryCode shouldBe "VN"
        flight.metadata?.countryFlagUrl shouldBe "https://flagcdn.com/h80/vn.png"
        flight.metadata?.imageUrl shouldBe "https://images.example/A321.jpg"
    }
}
