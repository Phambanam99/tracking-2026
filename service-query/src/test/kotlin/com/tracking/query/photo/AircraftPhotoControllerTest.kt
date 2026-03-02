package com.tracking.query.photo

import com.tracking.query.config.JwtAuthFilter
import java.time.Instant
import org.junit.jupiter.api.Test
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
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

@WebMvcTest(
    controllers = [AircraftPhotoController::class],
    excludeFilters = [ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = [JwtAuthFilter::class])],
)
@AutoConfigureMockMvc(addFilters = false)
class AircraftPhotoControllerTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @MockBean
    lateinit var aircraftPhotoCacheService: AircraftPhotoCacheService

    @Test
    fun `should return local aircraft photo when cached`() {
        whenever(aircraftPhotoCacheService.loadCachedPhoto("ABC123"))
            .thenReturn(
                StoredAircraftPhoto(
                    icao = "ABC123",
                    bytes = byteArrayOf(1, 2, 3),
                    contentType = "image/jpeg",
                    sourceUrl = "https://cdn.planespotters.net/photo/test.jpg",
                    cachedAt = Instant.parse("2026-03-02T07:00:00Z"),
                ),
            )

        mockMvc.get("/api/v1/aircraft/ABC123/photo/local")
            .andExpect {
                status { isOk() }
                content { contentType(MediaType.IMAGE_JPEG) }
                content { bytes(byteArrayOf(1, 2, 3)) }
            }
    }

    @Test
    fun `should enqueue warmup and return 404 when local photo is missing`() {
        whenever(aircraftPhotoCacheService.loadCachedPhoto("ABC123")).thenReturn(null)

        mockMvc.get("/api/v1/aircraft/ABC123/photo/local")
            .andExpect {
                status { isNotFound() }
            }

        verify(aircraftPhotoCacheService).enqueueWarmup(eq("ABC123"))
    }

    @Test
    fun `should return cached photo metadata when local photo exists`() {
        whenever(aircraftPhotoCacheService.loadCachedPhotoMetadata("ABC123"))
            .thenReturn(
                AircraftPhotoCacheMetadata(
                    icao = "ABC123",
                    cacheHit = true,
                    sourceUrl = "https://cdn.planespotters.net/photo/test.jpg",
                    cachedAt = Instant.parse("2026-03-02T07:00:00Z"),
                    contentType = "image/jpeg",
                    localPhotoUrl = "/api/v1/aircraft/ABC123/photo/local",
                ),
            )

        mockMvc.get("/api/v1/aircraft/ABC123/photo/metadata")
            .andExpect {
                status { isOk() }
                content { contentType(MediaType.APPLICATION_JSON) }
                jsonPath("$.icao") { value("ABC123") }
                jsonPath("$.cacheHit") { value(true) }
                jsonPath("$.sourceUrl") { value("https://cdn.planespotters.net/photo/test.jpg") }
                jsonPath("$.cachedAt") { value("2026-03-02T07:00:00Z") }
                jsonPath("$.contentType") { value("image/jpeg") }
                jsonPath("$.localPhotoUrl") { value("/api/v1/aircraft/ABC123/photo/local") }
            }
    }

    @Test
    fun `should return miss metadata and enqueue warmup when local photo is missing`() {
        whenever(aircraftPhotoCacheService.loadCachedPhotoMetadata("ABC123"))
            .thenReturn(
                AircraftPhotoCacheMetadata(
                    icao = "ABC123",
                    cacheHit = false,
                    sourceUrl = null,
                    cachedAt = null,
                    contentType = null,
                    localPhotoUrl = null,
                ),
            )

        mockMvc.get("/api/v1/aircraft/ABC123/photo/metadata")
            .andExpect {
                status { isOk() }
                content { contentType(MediaType.APPLICATION_JSON) }
                jsonPath("$.icao") { value("ABC123") }
                jsonPath("$.cacheHit") { value(false) }
                jsonPath("$.sourceUrl") { doesNotExist() }
                jsonPath("$.cachedAt") { doesNotExist() }
                jsonPath("$.contentType") { doesNotExist() }
                jsonPath("$.localPhotoUrl") { doesNotExist() }
            }

        verify(aircraftPhotoCacheService).enqueueWarmup(eq("ABC123"))
    }
}
