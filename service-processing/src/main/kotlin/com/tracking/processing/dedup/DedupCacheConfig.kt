package com.tracking.processing.dedup

import com.github.benmanes.caffeine.cache.Cache
import com.github.benmanes.caffeine.cache.Caffeine
import java.time.Duration

public class DedupCacheConfig(
    private val ttl: Duration = Duration.ofSeconds(2),
    private val maxSize: Long = 1_000_000,
) {
    private val dedupCache: Cache<String, Boolean> =
        Caffeine.newBuilder()
            .maximumSize(maxSize)
            .expireAfterWrite(ttl)
            .build()

    public fun isDuplicateAndRemember(key: String): Boolean {
        val existing = dedupCache.asMap().putIfAbsent(key, true)
        return existing != null
    }

    public fun cleanUp(): Unit {
        dedupCache.cleanUp()
    }
}
