package com.tracking.query.ship

import com.tracking.query.dto.BoundingBoxDto
import com.tracking.query.dto.ShipSearchRequest
import java.sql.Timestamp
import kotlin.math.roundToLong
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest
import org.springframework.context.annotation.Import
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.TestPropertySource
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@JdbcTest
@Import(ShipQueryService::class)
@TestPropertySource(
    properties = [
        "spring.datasource.url=jdbc:h2:mem:ship-query-it;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
    ],
)
class ShipQueryServiceIntegrationTest {

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @Autowired
    lateinit var shipQueryService: ShipQueryService

    @BeforeEach
    fun setUp() {
        jdbcTemplate.execute(
            "CREATE ALIAS IF NOT EXISTS TO_TIMESTAMP FOR \"com.tracking.query.ship.ShipQueryServiceIntegrationTest.toTimestamp\"",
        )
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
    fun `search returns newest row per mmsi from real jdbc query`() {
        insertShipPosition(
            mmsi = "574001230",
            lat = 10.0,
            lon = 106.0,
            eventTime = 1_700_000_000_000,
            sourceId = "AIS-OLD",
            vesselName = "PACIFIC TRADER",
            vesselType = "cargo",
            metadata = """{"is_military":false}""",
        )
        insertShipPosition(
            mmsi = "574001230",
            lat = 10.5,
            lon = 106.5,
            eventTime = 1_700_000_600_000,
            sourceId = "AIS-NEW",
            vesselName = "PACIFIC TRADER",
            vesselType = "cargo",
            metadata = """{"is_military":true}""",
        )
        insertShipPosition(
            mmsi = "563001999",
            lat = 11.0,
            lon = 107.0,
            eventTime = 1_700_000_300_000,
            sourceId = "AIS-OTHER",
            vesselName = "HARBOR QUEEN",
            vesselType = "passenger",
            metadata = """{"is_military":false}""",
        )

        val results = shipQueryService.search("PACIFIC", 10)

        assertEquals(1, results.size)
        assertEquals("574001230", results[0].mmsi)
        assertEquals(10.5, results[0].lat)
        assertEquals("AIS-NEW", results[0].sourceId)
        assertTrue(results[0].isMilitary)
    }

    @Test
    fun `searchHistory applies filters and keeps newest events first`() {
        insertShipPosition(
            mmsi = "574001230",
            lat = 21.0285,
            lon = 105.8542,
            speed = 13.0,
            course = 170.0,
            heading = 171.0,
            eventTime = 1_700_000_000_000,
            sourceId = "AIS-E2E",
            vesselName = "PACIFIC TRADER",
            vesselType = "cargo",
            destination = "SG SIN",
            metadata = """{"is_military":false}""",
        )
        insertShipPosition(
            mmsi = "574001230",
            lat = 21.0385,
            lon = 105.8642,
            speed = 14.0,
            course = 175.0,
            heading = 176.0,
            eventTime = 1_700_000_300_000,
            sourceId = "AIS-E2E",
            vesselName = "PACIFIC TRADER",
            vesselType = "cargo",
            destination = "SG SIN",
            metadata = """{"is_military":false}""",
        )
        insertShipPosition(
            mmsi = "574001230",
            lat = 30.0,
            lon = 120.0,
            speed = 15.0,
            course = 180.0,
            heading = 181.0,
            eventTime = 1_700_000_400_000,
            sourceId = "AIS-OTHER",
            vesselName = "PACIFIC TRADER",
            vesselType = "cargo",
            destination = "HK HKG",
            metadata = """{"is_military":false}""",
        )

        val request = ShipSearchRequest(
            mmsi = "574001230",
            vesselName = "PACIFIC",
            timeFrom = 1_699_999_900_000,
            timeTo = 1_700_000_350_000,
            boundingBox = BoundingBoxDto(
                north = 21.1,
                south = 21.0,
                east = 105.9,
                west = 105.7,
            ),
            sourceId = "AIS-E2E",
            limit = 10,
        )

        val results = shipQueryService.searchHistory(request)

        assertEquals(2, results.size)
        assertEquals(1_700_000_300_000, results[0].eventTime)
        assertEquals(1_700_000_000_000, results[1].eventTime)
        assertTrue(results.all { it.sourceId == "AIS-E2E" })
    }

    @Test
    fun `getHistory returns only requested mmsi within time range ordered by newest first`() {
        insertShipPosition(
            mmsi = "574001230",
            lat = 10.0,
            lon = 106.0,
            eventTime = 1_700_000_000_000,
            sourceId = "AIS-A",
        )
        insertShipPosition(
            mmsi = "574001230",
            lat = 10.2,
            lon = 106.2,
            eventTime = 1_700_000_200_000,
            sourceId = "AIS-B",
        )
        insertShipPosition(
            mmsi = "574001230",
            lat = 10.4,
            lon = 106.4,
            eventTime = 1_700_000_400_000,
            sourceId = "AIS-C",
        )
        insertShipPosition(
            mmsi = "563001999",
            lat = 11.0,
            lon = 107.0,
            eventTime = 1_700_000_300_000,
            sourceId = "AIS-OTHER",
        )

        val results = shipQueryService.getHistory(
            "574001230",
            1_700_000_100_000,
            1_700_000_500_000,
            10,
        )

        assertEquals(2, results.size)
        assertEquals(listOf(1_700_000_400_000, 1_700_000_200_000), results.map { it.eventTime })
        assertTrue(results.all { it.mmsi == "574001230" })
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

    companion object {
        @JvmStatic
        fun toTimestamp(epochSeconds: Double?): Timestamp? {
            if (epochSeconds == null) {
                return null
            }
            return Timestamp(epochSeconds.times(1000.0).roundToLong())
        }
    }
}
