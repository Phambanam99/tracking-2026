package com.tracking.query.cache

import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.redis.core.SetOperations
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.core.ZSetOperations

class StaleIndexCleanerTest {

    private val redisTemplate: StringRedisTemplate = mock()
    private val setOps: SetOperations<String, String> = mock()
    private val zSetOps: ZSetOperations<String, String> = mock()

    private val cleaner = StaleIndexCleaner(
        redisTemplate = redisTemplate,
        keyPrefix = "aircraft:",
        indexKey = "aircraft:index",
        geoKey = "aircraft:geo",
    )

    @BeforeEach
    fun setUp() {
        whenever(redisTemplate.opsForSet()).thenReturn(setOps)
        whenever(redisTemplate.opsForZSet()).thenReturn(zSetOps)
    }

    @Test
    fun `removes stale ICAO when hash key has expired`() {
        whenever(setOps.members("aircraft:index")).thenReturn(mutableSetOf("ABC123", "DEF456"))
        // ABC123 key exists (live), DEF456 key has expired
        whenever(redisTemplate.hasKey("aircraft:ABC123")).thenReturn(true)
        whenever(redisTemplate.hasKey("aircraft:DEF456")).thenReturn(false)

        cleaner.cleanupStaleEntries()

        verify(setOps).remove("aircraft:index", "DEF456")
        verify(zSetOps).remove("aircraft:geo", "DEF456")
        verify(setOps, never()).remove(eq("aircraft:index"), eq("ABC123"))
    }

    @Test
    fun `does not remove live entries`() {
        whenever(setOps.members("aircraft:index")).thenReturn(mutableSetOf("ABC123"))
        whenever(redisTemplate.hasKey("aircraft:ABC123")).thenReturn(true)

        cleaner.cleanupStaleEntries()

        verify(setOps, never()).remove(any(), any())
    }

    @Test
    fun `does nothing when index is empty`() {
        whenever(setOps.members("aircraft:index")).thenReturn(mutableSetOf())

        cleaner.cleanupStaleEntries()

        verify(setOps, never()).remove(any(), any())
    }

    @Test
    fun `returns when index members is null`() {
        whenever(setOps.members("aircraft:index")).thenReturn(null)

        // Should not throw
        cleaner.cleanupStaleEntries()

        verify(setOps, never()).remove(any(), any())
    }
}
