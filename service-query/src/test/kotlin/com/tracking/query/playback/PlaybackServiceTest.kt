package com.tracking.query.playback

import com.tracking.query.dto.BoundingBoxDto
import com.tracking.query.dto.PlaybackFrameRequest
import java.sql.Timestamp
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper

class PlaybackServiceTest {

    @Test
    fun `getPlaybackFrames binds timestamps directly in playback candidate filter`() {
        val jdbcTemplate = mock<JdbcTemplate>()
        val frameAssembler = PlaybackFrameAssembler()
        val service = PlaybackService(jdbcTemplate, frameAssembler)
        val request = PlaybackFrameRequest(
            timeFrom = 1_740_960_000_000,
            timeTo = 1_740_960_900_000,
            boundingBox = BoundingBoxDto(
                north = 23.5,
                south = 8.0,
                east = 110.0,
                west = 102.0,
            ),
            bucketSizeMs = 15_000,
            maxFrames = 200,
        )

        whenever(
            jdbcTemplate.query(
                any<String>(),
                any<RowMapper<PlaybackQueryRow>>(),
                eq(15_000L),
                eq(Timestamp(1_740_960_000_000)),
                eq(Timestamp(1_740_960_900_000)),
                eq(8.0),
                eq(23.5),
                eq(102.0),
                eq(110.0),
                eq(200),
            ),
        ).thenReturn(
            listOf(
                PlaybackQueryRow(
                    bucketTimeMs = 1_740_960_000_000,
                    icao = "ABC123",
                    lat = 21.0,
                    lon = 105.0,
                    altitude = 35_000,
                    speed = 480.0,
                    heading = 125.0,
                    eventTimeMs = 1_740_959_998_000,
                    sourceId = "adsb-hckt",
                    registration = "VN-A321",
                    aircraftType = "A321",
                    operator = "Vietnam Airlines",
                ),
            ),
        )

        val response = service.getPlaybackFrames(request)

        val sqlCaptor = ArgumentCaptor.forClass(String::class.java)
        verify(jdbcTemplate).query(
            sqlCaptor.capture(),
            any<RowMapper<PlaybackQueryRow>>(),
            eq(15_000L),
            eq(Timestamp(1_740_960_000_000)),
            eq(Timestamp(1_740_960_900_000)),
            eq(8.0),
            eq(23.5),
            eq(102.0),
            eq(110.0),
            eq(200),
        )

        assertTrue(sqlCaptor.value.contains("WHERE fp.event_time BETWEEN ? AND ?"))
        assertTrue(sqlCaptor.value.contains("time_bucket(make_interval(secs => ? / 1000.0), fp.event_time)"))
        assertEquals(1, response.returnedFrames)
        assertEquals("ABC123", response.frames.first().aircraft.first().icao)
    }
}
