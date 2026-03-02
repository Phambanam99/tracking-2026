package com.tracking.query.search

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.query.config.JwtAuthFilter
import com.tracking.query.dto.SearchResult
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
    controllers = [SearchController::class],
    excludeFilters = [ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = [JwtAuthFilter::class])],
)
@AutoConfigureMockMvc(addFilters = false)
class SearchControllerTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @MockBean
    lateinit var searchService: SearchService

    private val sampleResult = SearchResult(
        icao = "ABC123",
        lat = 21.0,
        lon = 105.0,
        altitude = 35000,
        speed = 480.0,
        heading = 125.0,
        eventTime = 1708941600000L,
        sourceId = "s1",
    )

    @Test
    fun `GET search returns 200 with results for valid query`() {
        whenever(searchService.searchGlobal(eq("abc123"), any())).thenReturn(listOf(sampleResult))

        mockMvc.get("/api/v1/aircraft/search?q=abc123")
            .andExpect {
                status { isOk() }
                content { contentType(MediaType.APPLICATION_JSON) }
                jsonPath("$[0].icao") { value("ABC123") }
            }
    }

    @Test
    fun `GET search returns 400 for query shorter than 2 chars`() {
        mockMvc.get("/api/v1/aircraft/search?q=a")
            .andExpect {
                status { isBadRequest() }
            }
    }

    @Test
    fun `GET search returns empty list when no matches`() {
        whenever(searchService.searchGlobal(any(), any())).thenReturn(emptyList())

        mockMvc.get("/api/v1/aircraft/search?q=nomatch")
            .andExpect {
                status { isOk() }
                jsonPath("$.length()") { value(0) }
            }
    }

    @Test
    fun `GET search respects custom limit param`() {
        whenever(searchService.searchGlobal(any(), eq(10))).thenReturn(listOf(sampleResult))

        mockMvc.get("/api/v1/aircraft/search?q=vn&limit=10")
            .andExpect {
                status { isOk() }
            }
    }

    @Test
    fun `GET live viewport returns matching live aircraft`() {
        whenever(searchService.findLiveInBoundingBox(eq(21.1), eq(21.0), eq(105.9), eq(105.7), eq(5000)))
            .thenReturn(listOf(sampleResult))

        mockMvc.get("/api/v1/aircraft/live?north=21.1&south=21.0&east=105.9&west=105.7")
            .andExpect {
                status { isOk() }
                content { contentType(MediaType.APPLICATION_JSON) }
                jsonPath("$[0].icao") { value("ABC123") }
            }
    }

    @Test
    fun `GET live viewport rejects invalid bounds`() {
        mockMvc.get("/api/v1/aircraft/live?north=20.0&south=21.0&east=105.9&west=105.7")
            .andExpect {
                status { isBadRequest() }
            }
    }

    @Test
    fun `POST search history returns 200 with valid request`() {
        whenever(searchService.searchHistory(any())).thenReturn(listOf(sampleResult))

        val body = mapOf(
            "icao" to "ABC123",
            "limit" to 50,
        )
        mockMvc.post("/api/v1/aircraft/search/history") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(body)
        }.andExpect {
            status { isOk() }
            jsonPath("$[0].icao") { value("ABC123") }
        }
    }

    @Test
    fun `POST search history returns 400 when no filters specified`() {
        val body = mapOf("limit" to 50)  // No icao/callsign/timeFrom/boundingBox/sourceId

        mockMvc.post("/api/v1/aircraft/search/history") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(body)
        }.andExpect {
            status { isBadRequest() }
        }
    }
}
