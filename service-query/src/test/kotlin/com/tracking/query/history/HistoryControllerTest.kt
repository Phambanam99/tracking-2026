package com.tracking.query.history

import com.tracking.query.config.JwtAuthFilter
import com.tracking.query.dto.FlightPositionDto
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
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

@WebMvcTest(
    controllers = [HistoryController::class],
    excludeFilters = [ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = [JwtAuthFilter::class])],
)
@AutoConfigureMockMvc(addFilters = false)
class HistoryControllerTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @MockBean
    lateinit var historyService: HistoryService

    private val samplePosition = FlightPositionDto(
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
    fun `GET history returns 200 for valid ICAO and time range`() {
        whenever(historyService.getHistory(eq("ABC123"), any(), any(), any()))
            .thenReturn(listOf(samplePosition))

        mockMvc.get("/api/v1/aircraft/ABC123/history?from=1000&to=2000")
            .andExpect {
                status { isOk() }
                jsonPath("$[0].icao") { value("ABC123") }
                jsonPath("$[0].altitude") { value(35000) }
            }
    }

    @Test
    fun `GET history returns 400 for invalid ICAO (too short)`() {
        mockMvc.get("/api/v1/aircraft/AB/history?from=1000&to=2000")
            .andExpect {
                status { isBadRequest() }
            }
    }

    @Test
    fun `GET history returns 400 for ICAO with non-hex chars`() {
        mockMvc.get("/api/v1/aircraft/ZZZZZZ/history?from=1000&to=2000")
            .andExpect {
                status { isBadRequest() }
            }
    }

    @Test
    fun `GET history returns 400 when from is greater than or equal to to`() {
        mockMvc.get("/api/v1/aircraft/ABC123/history?from=2000&to=1000")
            .andExpect {
                status { isBadRequest() }
            }
    }

    @Test
    fun `GET history coerces limit to 5000 maximum`() {
        whenever(historyService.getHistory(any(), any(), any(), eq(5000)))
            .thenReturn(emptyList())

        mockMvc.get("/api/v1/aircraft/ABC123/history?from=1000&to=2000&limit=99999")
            .andExpect {
                status { isOk() }
            }
    }

    @Test
    fun `GET history converts ICAO to uppercase before calling service`() {
        whenever(historyService.getHistory(eq("ABC123"), any(), any(), any()))
            .thenReturn(listOf(samplePosition))

        mockMvc.get("/api/v1/aircraft/abc123/history?from=1000&to=2000")
            .andExpect {
                status { isOk() }
            }
    }
}
