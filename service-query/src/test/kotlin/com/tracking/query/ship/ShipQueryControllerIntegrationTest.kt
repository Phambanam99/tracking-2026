package com.tracking.query.ship

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.query.config.JwtAuthFilter
import java.sql.Timestamp
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.ComponentScan
import org.springframework.context.annotation.FilterType
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.datasource.DriverManagerDataSource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import javax.sql.DataSource

@WebMvcTest(
    controllers = [ShipQueryController::class],
    excludeFilters = [ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = [JwtAuthFilter::class])],
)
@AutoConfigureMockMvc(addFilters = false)
@Import(ShipQueryService::class, ShipQueryControllerIntegrationTest.TestDbConfig::class)
class ShipQueryControllerIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @BeforeEach
    fun setUp() {
        jdbcTemplate.execute("CREATE SCHEMA IF NOT EXISTS storage")
        jdbcTemplate.execute(
            """
            CREATE TABLE IF NOT EXISTS storage.ship_positions (
                mmsi VARCHAR(32) NOT NULL,
                lat DOUBLE PRECISION NOT NULL,
                lon DOUBLE PRECISION NOT NULL,
                speed DOUBLE PRECISION NULL,
                course DOUBLE PRECISION NULL,
                heading DOUBLE PRECISION NULL,
                nav_status VARCHAR(128) NULL,
                event_time TIMESTAMP NOT NULL,
                source_id VARCHAR(128) NOT NULL,
                vessel_name VARCHAR(256) NULL,
                vessel_type VARCHAR(128) NULL,
                imo VARCHAR(32) NULL,
                call_sign VARCHAR(64) NULL,
                destination VARCHAR(256) NULL,
                metadata VARCHAR(2000) NULL
            )
            """.trimIndent(),
        )
        jdbcTemplate.update("DELETE FROM storage.ship_positions")
    }

    @Test
    fun `GET ship search returns real database result`() {
        insertShipPosition(
            mmsi = "574001230",
            lat = 21.0285,
            lon = 105.8542,
            eventTime = 1_700_000_000_000,
            sourceId = "AIS-E2E",
            vesselName = "PACIFIC TRADER",
            vesselType = "cargo",
            metadata = """{"is_military":true}""",
        )

        mockMvc.get("/api/v1/ships/search?q=pacific")
            .andExpect {
                status { isOk() }
                content { contentType(MediaType.APPLICATION_JSON) }
                jsonPath("$[0].mmsi") { value("574001230") }
                jsonPath("$[0].sourceId") { value("AIS-E2E") }
                jsonPath("$[0].isMilitary") { value(true) }
            }
    }

    @Test
    fun `POST ship search history returns filtered database results`() {
        insertShipPosition(
            mmsi = "574001230",
            lat = 21.0285,
            lon = 105.8542,
            speed = 12.5,
            eventTime = 1_700_000_000_000,
            sourceId = "AIS-E2E",
            vesselName = "PACIFIC TRADER",
            destination = "SG SIN",
        )
        insertShipPosition(
            mmsi = "574001230",
            lat = 30.0,
            lon = 120.0,
            speed = 25.0,
            eventTime = 1_700_000_100_000,
            sourceId = "AIS-OTHER",
            vesselName = "PACIFIC TRADER",
            destination = "HK HKG",
        )

        val body = mapOf(
            "mmsi" to "574001230",
            "sourceId" to "AIS-E2E",
            "speedMin" to 10.0,
            "speedMax" to 15.0,
            "limit" to 10,
        )

        mockMvc.post("/api/v1/ships/search/history") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(body)
        }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(1) }
            jsonPath("$[0].mmsi") { value("574001230") }
            jsonPath("$[0].sourceId") { value("AIS-E2E") }
            jsonPath("$[0].speed") { value(12.5) }
        }
    }

    @Test
    fun `GET ship history returns real history rows from database`() {
        insertShipPosition(
            mmsi = "574001230",
            lat = 21.0285,
            lon = 105.8542,
            speed = 12.5,
            course = 170.0,
            heading = 171.0,
            navStatus = "under_way_using_engine",
            eventTime = 1_700_000_000_000,
            sourceId = "AIS-E2E",
        )
        insertShipPosition(
            mmsi = "574001230",
            lat = 21.0385,
            lon = 105.8642,
            speed = 13.5,
            course = 175.0,
            heading = 176.0,
            navStatus = "under_way_using_engine",
            eventTime = 1_700_000_300_000,
            sourceId = "AIS-E2E",
        )
        insertShipPosition(
            mmsi = "563001999",
            lat = 11.0,
            lon = 107.0,
            eventTime = 1_700_000_200_000,
            sourceId = "AIS-OTHER",
        )

        mockMvc.get("/api/v1/ships/574001230/history?from=1699999900000&to=1700000400000&limit=10")
            .andExpect {
                status { isOk() }
                content { contentType(MediaType.APPLICATION_JSON) }
                jsonPath("$.length()") { value(2) }
                jsonPath("$[0].eventTime") { value(1_700_000_300_000) }
                jsonPath("$[1].eventTime") { value(1_700_000_000_000) }
                jsonPath("$[0].navStatus") { value("under_way_using_engine") }
            }
    }

    private fun insertShipPosition(
        mmsi: String,
        lat: Double,
        lon: Double,
        eventTime: Long,
        sourceId: String,
        speed: Double? = null,
        course: Double? = null,
        heading: Double? = null,
        navStatus: String? = null,
        vesselName: String? = null,
        vesselType: String? = null,
        imo: String? = null,
        callSign: String? = null,
        destination: String? = null,
        metadata: String? = null,
    ) {
        jdbcTemplate.update(
            """
            INSERT INTO storage.ship_positions (
                mmsi, lat, lon, speed, course, heading, nav_status, event_time, source_id,
                vessel_name, vessel_type, imo, call_sign, destination, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            mmsi,
            lat,
            lon,
            speed,
            course,
            heading,
            navStatus,
            Timestamp(eventTime),
            sourceId,
            vesselName,
            vesselType,
            imo,
            callSign,
            destination,
            metadata,
        )
    }

    @TestConfiguration
    class TestDbConfig {
        @Bean
        fun dataSource(): DataSource =
            DriverManagerDataSource().apply {
                setDriverClassName("org.h2.Driver")
                url = "jdbc:h2:mem:ship-query-controller-it;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1"
                username = "sa"
                password = ""
            }

        @Bean
        fun jdbcTemplate(dataSource: DataSource): JdbcTemplate = JdbcTemplate(dataSource)
    }

}
