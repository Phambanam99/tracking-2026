package com.tracking.processing.dedup

import io.kotest.matchers.shouldBe
import java.time.Duration
import kotlin.test.Test

public class DedupCacheConfigTest {
    @Test
    public fun `should mark repeated key as duplicate within ttl`() {
        val cache = DedupCacheConfig(ttl = Duration.ofMillis(120), maxSize = 100)
        val key = "ABC123_21.0_105.0_1700000000000"

        val first = cache.isDuplicateAndRemember(key)
        val second = cache.isDuplicateAndRemember(key)

        first shouldBe false
        second shouldBe true
    }

    @Test
    public fun `should allow key again after ttl expiration`() {
        val cache = DedupCacheConfig(ttl = Duration.ofMillis(50), maxSize = 100)
        val key = "ABC123_21.0_105.0_1700000000000"
        cache.isDuplicateAndRemember(key)

        Thread.sleep(120)
        cache.cleanUp()

        val afterTtl = cache.isDuplicateAndRemember(key)
        afterTtl shouldBe false
    }

    @Test
    public fun `should treat fresh cache instance as empty after restart`() {
        val key = "ABC123_21.0_105.0_1700000000000"
        val firstConsumerCache = DedupCacheConfig(ttl = Duration.ofSeconds(2), maxSize = 100)
        firstConsumerCache.isDuplicateAndRemember(key) shouldBe false
        firstConsumerCache.isDuplicateAndRemember(key) shouldBe true

        val rebalancedConsumerCache = DedupCacheConfig(ttl = Duration.ofSeconds(2), maxSize = 100)

        rebalancedConsumerCache.isDuplicateAndRemember(key) shouldBe false
    }
}
