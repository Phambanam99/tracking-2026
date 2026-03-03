package com.tracking.query.ship

import com.tracking.query.dto.BoundingBoxDto
import com.tracking.query.dto.ShipHistoryPositionDto
import com.tracking.query.dto.ShipSearchRequest
import com.tracking.query.dto.ShipSearchResult
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.junit.jupiter.api.Assertions.assertTrue

public class ShipQueryServiceTest {
    @Test
    public fun `search queries latest ship rows from storage ship_positions`() {
        val jdbcTemplate = mock<JdbcTemplate>()
        val service = ShipQueryService(jdbcTemplate)
        val sample = ShipSearchResult(
            mmsi = "574001230",
            lat = 21.0285,
            lon = 105.8542,
            eventTime = 1_700_000_000_000,
            sourceId = "AIS-E2E",
        )

        whenever(
            jdbcTemplate.query(
                any<String>(),
                any<RowMapper<ShipSearchResult>>(),
                eq("%574001230%"),
                eq("%574001230%"),
                eq("%574001230%"),
                eq("%574001230%"),
                eq("%574001230%"),
                eq("%574001230%"),
                eq(5),
            ),
        ).thenReturn(listOf(sample))

        val results = service.search("574001230", 5)

        val sqlCaptor = ArgumentCaptor.forClass(String::class.java)
        verify(jdbcTemplate).query(
            sqlCaptor.capture(),
            any<RowMapper<ShipSearchResult>>(),
            eq("%574001230%"),
            eq("%574001230%"),
            eq("%574001230%"),
            eq("%574001230%"),
            eq("%574001230%"),
            eq("%574001230%"),
            eq(5),
        )
        assertTrue(sqlCaptor.value.contains("FROM storage.ship_positions"))
        assertTrue(sqlCaptor.value.contains("DISTINCT ON (mmsi)"))
        assertTrue(results.first().mmsi == "574001230")
    }

    @Test
    public fun `searchHistory builds filtered query against storage ship_positions`() {
        val jdbcTemplate = mock<JdbcTemplate>()
        val service = ShipQueryService(jdbcTemplate)
        val request = ShipSearchRequest(
            mmsi = "574001230",
            sourceId = "AIS-E2E",
            boundingBox = BoundingBoxDto(
                north = 21.1,
                south = 21.0,
                east = 105.9,
                west = 105.7,
            ),
            limit = 25,
        )

        whenever(
            jdbcTemplate.query(
                any<String>(),
                any<RowMapper<ShipSearchResult>>(),
                eq("574001230%"),
                eq(21.0),
                eq(21.1),
                eq(105.7),
                eq(105.9),
                eq("AIS-E2E"),
                eq(25),
            ),
        ).thenReturn(emptyList())

        service.searchHistory(request)

        val sqlCaptor = ArgumentCaptor.forClass(String::class.java)
        verify(jdbcTemplate).query(
            sqlCaptor.capture(),
            any<RowMapper<ShipSearchResult>>(),
            eq("574001230%"),
            eq(21.0),
            eq(21.1),
            eq(105.7),
            eq(105.9),
            eq("AIS-E2E"),
            eq(25),
        )
        assertTrue(sqlCaptor.value.contains("FROM storage.ship_positions"))
        assertTrue(sqlCaptor.value.contains("mmsi LIKE ?"))
        assertTrue(sqlCaptor.value.contains("lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?"))
        assertTrue(sqlCaptor.value.contains("source_id = ?"))
    }

    @Test
    public fun `getHistory queries ship positions by mmsi and time range`() {
        val jdbcTemplate = mock<JdbcTemplate>()
        val service = ShipQueryService(jdbcTemplate)
        val sample = ShipHistoryPositionDto(
            mmsi = "574001230",
            lat = 21.0285,
            lon = 105.8542,
            eventTime = 1_700_000_000_000,
            sourceId = "AIS-E2E",
        )

        whenever(
            jdbcTemplate.query(
                any<String>(),
                any<RowMapper<ShipHistoryPositionDto>>(),
                eq("574001230"),
                eq(1_700_000_000_000L),
                eq(1_700_000_600_000L),
                eq(100),
            ),
        ).thenReturn(listOf(sample))

        val results = service.getHistory("574001230", 1_700_000_000_000L, 1_700_000_600_000L, 100)

        val sqlCaptor = ArgumentCaptor.forClass(String::class.java)
        verify(jdbcTemplate).query(
            sqlCaptor.capture(),
            any<RowMapper<ShipHistoryPositionDto>>(),
            eq("574001230"),
            eq(1_700_000_000_000L),
            eq(1_700_000_600_000L),
            eq(100),
        )
        assertTrue(sqlCaptor.value.contains("WHERE mmsi = ?"))
        assertTrue(sqlCaptor.value.contains("ORDER BY event_time DESC"))
        assertTrue(results.first().mmsi == "574001230")
    }
}
