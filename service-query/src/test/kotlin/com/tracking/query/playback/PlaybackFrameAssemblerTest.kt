package com.tracking.query.playback

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.assertEquals

class PlaybackFrameAssemblerTest {

    private val assembler = PlaybackFrameAssembler()

    @Test
    fun `assembles rows into chronological frames`() {
        val rows = listOf(
            PlaybackQueryRow(
                bucketTimeMs = 1_000,
                icao = "ABC123",
                lat = 21.0,
                lon = 105.0,
                altitude = 35_000,
                speed = 480.0,
                heading = 125.0,
                eventTimeMs = 990,
                sourceId = "s1",
                registration = "VN-A321",
                aircraftType = "A321",
                operator = "Vietnam Airlines",
            ),
            PlaybackQueryRow(
                bucketTimeMs = 2_000,
                icao = "DEF456",
                lat = 10.0,
                lon = 106.0,
                altitude = 30_000,
                speed = 420.0,
                heading = 90.0,
                eventTimeMs = 1_980,
                sourceId = "s2",
                registration = "VN-A222",
                aircraftType = "A320",
                operator = "Demo Air",
            ),
        )

        val frames = assembler.assemble(rows)

        assertEquals(2, frames.size)
        assertEquals(1_000, frames[0].timestamp)
        assertEquals("ABC123", frames[0].aircraft.first().icao)
        assertEquals(2_000, frames[1].timestamp)
        assertEquals("DEF456", frames[1].aircraft.first().icao)
    }

    @Test
    fun `keeps only latest event per aircraft in a bucket`() {
        val rows = listOf(
            PlaybackQueryRow(
                bucketTimeMs = 1_000,
                icao = "ABC123",
                lat = 20.0,
                lon = 105.0,
                altitude = 10_000,
                speed = 300.0,
                heading = 100.0,
                eventTimeMs = 900,
                sourceId = "s1",
                registration = null,
                aircraftType = null,
                operator = null,
            ),
            PlaybackQueryRow(
                bucketTimeMs = 1_000,
                icao = "ABC123",
                lat = 21.0,
                lon = 106.0,
                altitude = 11_000,
                speed = 320.0,
                heading = 110.0,
                eventTimeMs = 990,
                sourceId = "s1",
                registration = null,
                aircraftType = null,
                operator = null,
            ),
        )

        val frames = assembler.assemble(rows)

        assertEquals(1, frames.size)
        assertEquals(1, frames[0].aircraft.size)
        assertEquals(21.0, frames[0].aircraft.first().lat)
        assertEquals(106.0, frames[0].aircraft.first().lon)
    }
}
