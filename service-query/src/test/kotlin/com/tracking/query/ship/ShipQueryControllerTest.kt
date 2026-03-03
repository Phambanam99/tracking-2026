package com.tracking.query.ship

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.query.config.JwtAuthFilter
import com.tracking.query.dto.ShipHistoryPositionDto
import com.tracking.query.dto.ShipSearchResult
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.context.annotation.ComponentScan
import org.springframework.context.annotation.FilterType
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post

@WebMvcTest(
    controllers = [ShipQueryController::class],
    excludeFilters = [ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = [JwtAuthFilter::class])],
)
@AutoConfigureMockMvc(addFilters = false)
class ShipQueryControllerTest {
    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @MockBean
    lateinit var shipQueryService: ShipQueryService

    private val sampleSearchResult = ShipSearchResult(
        mmsi = "574001230",
        lat = 21.0,
        lon = 105.0,
        speed = 12.4,
        course = 180.0,
        heading = 180.0,
        eventTime = 1708941600000L,
        sourceId = "ais-1",
        vesselName = "PACIFIC TRADER",
        vesselType = "cargo",
        imo = "9876543",
        callSign = "3WAB2",
        destination = "SG SIN",
    )

    private val sampleHistory = ShipHistoryPositionDto(
        mmsi = "574001230",
        lat = 21.0,
        lon = 105.0,
        speed = 12.4,
        course = 180.0,
        heading = 180.0,
        navStatus = "under_way_using_engine",
        eventTime = 1708941600000L,
        sourceId = "ais-1",
    )

    @Test
    fun `GET ship search returns 200 with results for valid query`() {
        whenever(shipQueryService.search(eq("pacific"), any())).thenReturn(listOf(sampleSearchResult))

        mockMvc.get("/api/v1/ships/search?q=pacific")
            .andExpect {
                status { isOk() }
                content { contentType(MediaType.APPLICATION_JSON) }
                jsonPath("$[0].mmsi") { value("574001230") }
            }
    }

    @Test
    fun `GET ship search returns 400 for query shorter than 2 chars`() {
        mockMvc.get("/api/v1/ships/search?q=p")
            .andExpect {
                status { isBadRequest() }
            }
    }

    @Test
    fun `POST ship search history returns 200 with valid request`() {
        whenever(shipQueryService.searchHistory(any())).thenReturn(listOf(sampleSearchResult))

        val body = mapOf(
            "mmsi" to "574001230",
            "limit" to 50,
        )
        mockMvc.post("/api/v1/ships/search/history") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(body)
        }.andExpect {
            status { isOk() }
            jsonPath("$[0].mmsi") { value("574001230") }
        }
    }

    @Test
    fun `POST ship search history returns 400 when no filters specified`() {
        val body = mapOf("limit" to 50)

        mockMvc.post("/api/v1/ships/search/history") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(body)
        }.andExpect {
            status { isBadRequest() }
        }
    }

    @Test
    fun `GET ship history returns 200 for valid mmsi and time range`() {
        whenever(shipQueryService.getHistory(eq("574001230"), any(), any(), any()))
            .thenReturn(listOf(sampleHistory))

        mockMvc.get("/api/v1/ships/574001230/history?from=1000&to=2000")
            .andExpect {
                status { isOk() }
                jsonPath("$[0].mmsi") { value("574001230") }
                jsonPath("$[0].navStatus") { value("under_way_using_engine") }
            }
    }

    @Test
    fun `GET ship history returns 400 for invalid mmsi`() {
        mockMvc.get("/api/v1/ships/57A/history?from=1000&to=2000")
            .andExpect {
                status { isBadRequest() }
            }
    }

    @Test
    fun `GET ship history returns 400 when from is greater than or equal to to`() {
        mockMvc.get("/api/v1/ships/574001230/history?from=2000&to=1000")
            .andExpect {
                status { isBadRequest() }
            }
    }
}
