package com.tracking.query.cache

import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.data.geo.Distance
import org.springframework.data.geo.GeoResult
import org.springframework.data.geo.GeoResults
import org.springframework.data.geo.Point
import org.springframework.data.redis.connection.RedisGeoCommands
import org.springframework.data.redis.core.GeoOperations
import org.springframework.data.redis.core.HashOperations
import org.springframework.data.redis.connection.RedisGeoCommands.GeoLocation
import org.springframework.data.redis.core.SetOperations
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.domain.geo.BoundingBox
import org.springframework.data.redis.domain.geo.GeoReference

class LiveAircraftCacheReaderTest {

    private val redisTemplate: StringRedisTemplate = mock()
    private val setOps: SetOperations<String, String> = mock()
    private val hashOps: HashOperations<String, String, String> = mock()
    private val geoOps: GeoOperations<String, String> = mock()
    private val aircraftReferenceLookup: AircraftReferenceLookup = mock()

    private val reader = LiveAircraftCacheReader(
        redisTemplate = redisTemplate,
        aircraftReferenceLookup = aircraftReferenceLookup,
        keyPrefix = "aircraft:",
        indexKey = "aircraft:index",
        geoKey = "aircraft:geo",
    )

    @BeforeEach
    fun setUp() {
        whenever(redisTemplate.opsForSet()).thenReturn(setOps)
        whenever(redisTemplate.opsForHash<String, String>()).thenReturn(hashOps)
        whenever(redisTemplate.opsForGeo()).thenReturn(geoOps)
        whenever(aircraftReferenceLookup.findByIcao(any())).thenReturn(null)
    }

    private fun mockIndex(vararg icaos: String) {
        whenever(setOps.members("aircraft:index")).thenReturn(icaos.toMutableSet())
    }

    private fun mockHash(icao: String, vararg pairs: Pair<String, String>) {
        whenever(hashOps.entries("aircraft:$icao"))
            .thenReturn(pairs.toMap().toMutableMap())
    }

    private fun flightHash(
        icao: String,
        lat: Double = 21.0,
        lon: Double = 105.0,
        registration: String? = null,
        aircraftType: String? = null,
        operator: String? = null,
        isMilitary: Boolean = false,
    ): Array<Pair<String, String>> {
        val pairs = mutableListOf(
            "icao" to icao,
            "lat" to lat.toString(),
            "lon" to lon.toString(),
            "event_time" to "1000",
            "source_id" to "s1",
        )
        registration?.let { pairs.add("registration" to it) }
        aircraftType?.let { pairs.add("aircraft_type" to it) }
        operator?.let { pairs.add("operator" to it) }
        if (isMilitary) {
            pairs.add("is_military" to true.toString())
        }
        return pairs.toTypedArray()
    }

    @Test
    fun `returns empty list when index is empty`() {
        mockIndex()

        reader.searchLive("ABC", 100).shouldBeEmpty()
    }

    @Test
    fun `returns empty list for query shorter than 2 chars`() {
        mockIndex("ABC123")

        reader.searchLive("A", 100).shouldBeEmpty()
    }

    @Test
    fun `ICAO prefix search matches correctly`() {
        mockIndex("ABC123", "DEF456", "ABC789")
        mockHash("ABC123", *flightHash("ABC123"))
        mockHash("ABC789", *flightHash("ABC789"))

        val results = reader.searchLive("abc", 100)

        results shouldHaveSize 2
        results.map { it.icao } shouldBe listOf("ABC123", "ABC789")
    }

    @Test
    fun `text match on registration field`() {
        mockIndex("ABC123", "DEF456")
        mockHash("ABC123", *flightHash("ABC123", registration = "VN-A321"))
        mockHash("DEF456", *flightHash("DEF456", registration = "VN-B737"))

        val results = reader.searchLive("vn-a321", 100)

        results shouldHaveSize 1
        results.first().icao shouldBe "ABC123"
    }

    @Test
    fun `text match on aircraft type field`() {
        mockIndex("ABC123")
        mockHash("ABC123", *flightHash("ABC123", aircraftType = "A321"))

        val results = reader.searchLive("a321", 100)

        results shouldHaveSize 1
    }

    @Test
    fun `text match on operator field`() {
        mockIndex("ABC123")
        mockHash("ABC123", *flightHash("ABC123", operator = "Vietnam Airlines"))

        val results = reader.searchLive("vietnam", 100)

        results shouldHaveSize 1
    }

    @Test
    fun `search falls back to reference metadata when redis hash misses aircraft type`() {
        mockIndex("040033")
        mockHash("040033", *flightHash("040033"))
        whenever(aircraftReferenceLookup.findByIcao("040033"))
            .thenReturn(AircraftReferenceMetadata(registration = "ET-ANR", aircraftType = "B77L", operator = "Ethiopian"))

        val results = reader.searchLive("b77l", 100)

        results shouldHaveSize 1
        results.single().aircraftType shouldBe "B77L"
        results.single().registration shouldBe "ET-ANR"
    }

    @Test
    fun `maxResults limits result count`() {
        val icaos = (1..10).map { "A%05X".format(it) }
        mockIndex(*icaos.toTypedArray())
        icaos.forEach { mockHash(it, *flightHash(it, registration = "REG-TEST")) }

        val results = reader.searchLive("reg-test", maxResults = 3)

        results shouldHaveSize 3
    }

    @Test
    fun `skips ICAO when hash is empty (expired key)`() {
        mockIndex("ABC123")
        whenever(hashOps.entries("aircraft:ABC123")).thenReturn(emptyMap())

        val results = reader.searchLive("abc", 100)

        results.shouldBeEmpty()
    }

    @Test
    fun `returns live aircraft inside a bounding box`() {
        mockHash("ABC123", *flightHash("ABC123", lat = 21.02, lon = 105.81, aircraftType = "A321", isMilitary = true))
        mockHash("DEF456", *flightHash("DEF456", lat = 21.04, lon = 105.84, aircraftType = "B738"))
        mockHash("OUT999", *flightHash("OUT999", lat = 10.0, lon = 106.0, aircraftType = "A359"))
        whenever(
            geoOps.search(
                eq("aircraft:geo"),
                any<GeoReference<String>>(),
                any<BoundingBox>(),
                any<RedisGeoCommands.GeoSearchCommandArgs>(),
            ),
        )
            .thenReturn(
                GeoResults(
                    listOf(
                        GeoResult(GeoLocation("ABC123", Point(105.81, 21.02)), Distance(0.0)),
                        GeoResult(GeoLocation("DEF456", Point(105.84, 21.04)), Distance(0.0)),
                    ),
                ),
            )

        val results = reader.findInBoundingBox(
            north = 21.1,
            south = 21.0,
            east = 105.9,
            west = 105.7,
            maxResults = 100,
        )

        results shouldHaveSize 2
        results.map { it.icao } shouldBe listOf("ABC123", "DEF456")
        results.first().isMilitary shouldBe true
    }

    @Test
    fun `defaults military flag to false when hash field is absent`() {
        mockHash("ABC123", *flightHash("ABC123"))
        whenever(
            geoOps.search(
                eq("aircraft:geo"),
                any<GeoReference<String>>(),
                any<BoundingBox>(),
                any<RedisGeoCommands.GeoSearchCommandArgs>(),
            ),
        )
            .thenReturn(
                GeoResults(
                    listOf(
                        GeoResult(GeoLocation("ABC123", Point(105.0, 21.0)), Distance(0.0)),
                    ),
                ),
            )

        val results = reader.findInBoundingBox(
            north = 21.1,
            south = 20.9,
            east = 105.1,
            west = 104.9,
            maxResults = 10,
        )

        results.single().isMilitary shouldBe false
    }

    @Test
    fun `bounding box query backfills missing reference metadata`() {
        mockHash("505D58", *flightHash("505D58", lat = 21.02, lon = 105.81))
        whenever(aircraftReferenceLookup.findByIcao("505D58"))
            .thenReturn(AircraftReferenceMetadata(registration = "OM-JEX", aircraftType = "B738", operator = "Jet"))
        whenever(
            geoOps.search(
                eq("aircraft:geo"),
                any<GeoReference<String>>(),
                any<BoundingBox>(),
                any<RedisGeoCommands.GeoSearchCommandArgs>(),
            ),
        )
            .thenReturn(
                GeoResults(
                    listOf(
                        GeoResult(GeoLocation("505D58", Point(105.81, 21.02)), Distance(0.0)),
                    ),
                ),
            )

        val results = reader.findInBoundingBox(
            north = 21.1,
            south = 20.9,
            east = 105.9,
            west = 105.7,
            maxResults = 10,
        )

        results.single().aircraftType shouldBe "B738"
        results.single().registration shouldBe "OM-JEX"
    }

    @Test
    fun `bounding box query respects max results`() {
        mockHash("ABC123", *flightHash("ABC123", lat = 21.02, lon = 105.81))
        mockHash("DEF456", *flightHash("DEF456", lat = 21.03, lon = 105.82))
        whenever(
            geoOps.search(
                eq("aircraft:geo"),
                any<GeoReference<String>>(),
                any<BoundingBox>(),
                any<RedisGeoCommands.GeoSearchCommandArgs>(),
            ),
        )
            .thenReturn(
                GeoResults(
                    listOf(
                        GeoResult(GeoLocation("ABC123", Point(105.81, 21.02)), Distance(0.0)),
                        GeoResult(GeoLocation("DEF456", Point(105.82, 21.03)), Distance(0.0)),
                    ),
                ),
            )

        val results = reader.findInBoundingBox(
            north = 21.1,
            south = 21.0,
            east = 105.9,
            west = 105.7,
            maxResults = 2,
        )

        results shouldHaveSize 2
    }
}
