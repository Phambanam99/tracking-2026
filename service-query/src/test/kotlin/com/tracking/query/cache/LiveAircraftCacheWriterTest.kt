package com.tracking.query.cache

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.tracking.common.dto.AircraftMetadata
import com.tracking.common.dto.EnrichedFlight
import com.tracking.query.photo.AircraftPhotoCacheService
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.redis.core.RedisCallback
import org.springframework.data.redis.core.StringRedisTemplate

class LiveAircraftCacheWriterTest {

    private val redisTemplate: StringRedisTemplate = mock()
    private val objectMapper = ObjectMapper().registerKotlinModule()
    private val aircraftPhotoCacheService: AircraftPhotoCacheService = mock()

    private val writer = LiveAircraftCacheWriter(
        redisTemplate = redisTemplate,
        objectMapper = objectMapper,
        aircraftPhotoCacheService = aircraftPhotoCacheService,
        ttlSeconds = 300L,
        keyPrefix = "aircraft:",
        indexKey = "aircraft:index",
        geoKey = "aircraft:geo",
    )

    @BeforeEach
    fun setUp() {
        whenever(redisTemplate.executePipelined(any<RedisCallback<*>>()))
            .thenReturn(emptyList<Any>())
    }

    @Test
    fun `should execute pipeline on valid flight message`() {
        val json = objectMapper.writeValueAsString(
            EnrichedFlight(
                icao = "ABC123",
                lat = 21.0285,
                lon = 105.8542,
                altitude = 35000,
                speed = 480.5,
                heading = 125.0,
                eventTime = 1708941600000L,
                sourceId = "crawler_hn_1",
            ),
        )
        val record = ConsumerRecord("live-adsb", 0, 0L, "ABC123", json)

        writer.onLiveFlight(record)

        verify(redisTemplate).executePipelined(any<RedisCallback<*>>())
        verify(aircraftPhotoCacheService).enqueueWarmup("ABC123")
    }

    @Test
    fun `should not throw on malformed JSON`() {
        val record = ConsumerRecord("live-adsb", 0, 0L, "BAD", "{not valid json}")

        // Should not throw — errors are swallowed and logged
        writer.onLiveFlight(record)
    }

    @Test
    fun `should include metadata fields when present`() {
        val flight = EnrichedFlight(
            icao = "780A3B",
            lat = 10.0,
            lon = 106.0,
            eventTime = 1000L,
            sourceId = "s1",
            metadata = AircraftMetadata(
                registration = "VN-A321",
                aircraftType = "A321",
                operator = "Vietnam Airlines",
                countryCode = "vn",
                isMilitary = true,
            ),
        )
        val json = objectMapper.writeValueAsString(flight)
        val record = ConsumerRecord("live-adsb", 0, 1L, "780A3B", json)

        writer.onLiveFlight(record)

        verify(redisTemplate).executePipelined(any<RedisCallback<*>>())
        verify(aircraftPhotoCacheService).enqueueWarmup("780A3B")
    }
}
