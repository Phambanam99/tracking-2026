package com.tracking.query.playback

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.query.config.JwtAuthFilter
import com.tracking.query.dto.BoundingBoxDto
import com.tracking.query.dto.PlaybackAircraftDto
import com.tracking.query.dto.PlaybackFrameDto
import com.tracking.query.dto.PlaybackFrameMetadataDto
import com.tracking.query.dto.PlaybackFrameResponse
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.context.annotation.ComponentScan
import org.springframework.context.annotation.FilterType
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post

@WebMvcTest(
    controllers = [PlaybackController::class],
    excludeFilters = [ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = [JwtAuthFilter::class])],
)
@AutoConfigureMockMvc(addFilters = false)
class PlaybackControllerTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @MockBean
    lateinit var playbackService: PlaybackService

    @Test
    fun `POST playback frames returns 200 for valid request`() {
        whenever(playbackService.getPlaybackFrames(any())).thenReturn(
            PlaybackFrameResponse(
                frames = listOf(
                    PlaybackFrameDto(
                        timestamp = 1_740_960_000_000,
                        aircraft = listOf(
                            PlaybackAircraftDto(
                                icao = "ABC123",
                                lat = 21.0,
                                lon = 105.0,
                                altitude = 35_000,
                                speed = 480.0,
                                heading = 125.0,
                                eventTime = 1_740_959_998_000,
                                sourceId = "adsb-hckt",
                                registration = "VN-A321",
                                aircraftType = "A321",
                                operator = "Vietnam Airlines",
                            ),
                        ),
                    ),
                ),
                totalFrames = 1,
                returnedFrames = 1,
                hasMore = false,
                nextCursor = null,
                bucketSizeMs = 15_000,
                metadata = PlaybackFrameMetadataDto(
                    queryTimeMs = 20,
                    totalAircraftSeen = 1,
                ),
            ),
        )

        val body = mapOf(
            "timeFrom" to 1_740_960_000_000,
            "timeTo" to 1_740_960_900_000,
            "boundingBox" to mapOf(
                "north" to 23.5,
                "south" to 8.0,
                "east" to 110.0,
                "west" to 102.0,
            ),
            "bucketSizeMs" to 15_000,
            "maxFrames" to 200,
            "cursor" to null,
        )

        mockMvc.post("/api/v1/playback/frames") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(body)
        }.andExpect {
            status { isOk() }
            content { contentType(MediaType.APPLICATION_JSON) }
            jsonPath("$.returnedFrames") { value(1) }
            jsonPath("$.frames[0].aircraft[0].icao") { value("ABC123") }
        }
    }

    @Test
    fun `POST playback frames returns 400 for invalid time range`() {
        val body = mapOf(
            "timeFrom" to 1_740_960_900_000,
            "timeTo" to 1_740_960_000_000,
            "boundingBox" to mapOf(
                "north" to 23.5,
                "south" to 8.0,
                "east" to 110.0,
                "west" to 102.0,
            ),
        )

        mockMvc.post("/api/v1/playback/frames") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(body)
        }.andExpect {
            status { isBadRequest() }
        }
    }

    @Test
    fun `POST playback frames returns 400 for missing bounding box`() {
        val body = mapOf(
            "timeFrom" to 1_740_960_000_000,
            "timeTo" to 1_740_960_900_000,
        )

        mockMvc.post("/api/v1/playback/frames") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(body)
        }.andExpect {
            status { isBadRequest() }
        }
    }

    @Test
    fun `POST playback frames rejects time range longer than 7 days`() {
        val body = mapOf(
            "timeFrom" to 1_740_960_000_000,
            "timeTo" to 1_741_700_800_001,
            "boundingBox" to mapOf(
                "north" to 23.5,
                "south" to 8.0,
                "east" to 110.0,
                "west" to 102.0,
            ),
        )

        mockMvc.post("/api/v1/playback/frames") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(body)
        }.andExpect {
            status { isBadRequest() }
        }
    }
}
