package com.tracking.query.ship

import com.tracking.query.dto.BoundingBoxDto
import com.tracking.query.dto.ShipSearchRequest
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import java.sql.Timestamp
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest
import org.springframework.context.annotation.Import
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.TestPropertySource

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

        results shouldHaveSize 1
        results[0].mmsi shouldBe "574001230"
        results[0].lat shouldBe 10.5
        results[0].sourceId shouldBe "AIS-NEW"
        results[0].isMilitary.shouldBeTrue()
    }

    @Test
    fun `search respects limit across distinct mmsi rows`() {
        insertShipPosition(
            mmsi = "111111111",
            lat = 10.0,
            lon = 100.0,
            eventTime = 1_700_000_000_000,
            sourceId = "AIS-1",
            vesselType = "cargo",
        )
        insertShipPosition(
            mmsi = "222222222",
            lat = 11.0,
            lon = 101.0,
            eventTime = 1_700_000_100_000,
            sourceId = "AIS-2",
            vesselType = "cargo",
        )
        insertShipPosition(
            mmsi = "333333333",
            lat = 12.0,
            lon = 102.0,
            eventTime = 1_700_000_200_000,
            sourceId = "AIS-3",
            vesselType = "cargo",
        )

        val results = shipQueryService.search("cargo", 2)

        results shouldHaveSize 2
        results.map { it.mmsi } shouldContainExactlyInAnyOrder listOf("111111111", "222222222")
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

        results shouldHaveSize 2
        results[0].eventTime shouldBe 1_700_000_300_000
        results[1].eventTime shouldBe 1_700_000_000_000
        results.all { it.sourceId == "AIS-E2E" }.shouldBeTrue()
    }

    @Test
    fun `searchHistory applies speed range source filter and military metadata mapping`() {
        insertShipPosition(
            mmsi = "574001230",
            lat = 20.0,
            lon = 105.0,
            speed = 8.0,
            eventTime = 1_700_000_000_000,
            sourceId = "AIS-E2E",
            vesselName = "PACIFIC TRADER",
            metadata = """{"is_military":false}""",
        )
        insertShipPosition(
            mmsi = "574001230",
            lat = 20.1,
            lon = 105.1,
            speed = 12.5,
            eventTime = 1_700_000_100_000,
            sourceId = "AIS-E2E",
            vesselName = "PACIFIC TRADER",
            metadata = """{"is_military":true}""",
        )
        insertShipPosition(
            mmsi = "574001230",
            lat = 20.2,
            lon = 105.2,
            speed = 18.0,
            eventTime = 1_700_000_200_000,
            sourceId = "AIS-E2E",
            vesselName = "PACIFIC TRADER",
            metadata = """{"is_military":false}""",
        )
        insertShipPosition(
            mmsi = "574001230",
            lat = 20.3,
            lon = 105.3,
            speed = 13.0,
            eventTime = 1_700_000_300_000,
            sourceId = "AIS-OTHER",
            vesselName = "PACIFIC TRADER",
            metadata = """{"is_military":true}""",
        )

        val results = shipQueryService.searchHistory(
            ShipSearchRequest(
                mmsi = "574001230",
                speedMin = 10.0,
                speedMax = 15.0,
                sourceId = "AIS-E2E",
                limit = 10,
            ),
        )

        results shouldHaveSize 1
        results[0].speed shouldBe 12.5
        results[0].sourceId shouldBe "AIS-E2E"
        results[0].isMilitary.shouldBeTrue()
    }

    @Test
    fun `searchHistory applies limit after filtering`() {
        insertShipPosition(
            mmsi = "574001230",
            lat = 20.0,
            lon = 105.0,
            eventTime = 1_700_000_000_000,
            sourceId = "AIS-E2E",
            vesselName = "PACIFIC TRADER",
        )
        insertShipPosition(
            mmsi = "574001230",
            lat = 20.1,
            lon = 105.1,
            eventTime = 1_700_000_100_000,
            sourceId = "AIS-E2E",
            vesselName = "PACIFIC TRADER",
        )
        insertShipPosition(
            mmsi = "574001230",
            lat = 20.2,
            lon = 105.2,
            eventTime = 1_700_000_200_000,
            sourceId = "AIS-E2E",
            vesselName = "PACIFIC TRADER",
        )

        val results = shipQueryService.searchHistory(
            ShipSearchRequest(
                mmsi = "574001230",
                sourceId = "AIS-E2E",
                limit = 2,
            ),
        )

        results shouldHaveSize 2
        results.map { it.eventTime } shouldBe listOf(1_700_000_200_000, 1_700_000_100_000)
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

        results shouldHaveSize 2
        results.map { it.eventTime } shouldBe listOf(1_700_000_400_000, 1_700_000_200_000)
        results.all { it.mmsi == "574001230" }.shouldBeTrue()
    }

    @Test
    fun `search maps military metadata only when flag is true`() {
        insertShipPosition(
            mmsi = "574001230",
            lat = 10.0,
            lon = 106.0,
            eventTime = 1_700_000_000_000,
            sourceId = "AIS-E2E",
            vesselName = "PACIFIC TRADER",
            metadata = """{"is_military":false}""",
        )

        val results = shipQueryService.search("PACIFIC", 10)

        results shouldHaveSize 1
        results[0].isMilitary.shouldBeFalse()
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
}
