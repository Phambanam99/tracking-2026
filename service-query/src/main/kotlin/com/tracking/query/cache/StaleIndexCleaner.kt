package com.tracking.query.cache

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/**
 * Removes stale ICAO entries from `aircraft:index` SET after their hash keys have expired (TTL elapsed).
 *
 * The aircraft hash keys have TTL so they expire automatically, but the secondary indexes
 * (`aircraft:index` and `aircraft:geo`) do not. Without cleanup, the indexes grow unbounded.
 */
@Component
public class StaleIndexCleaner(
    private val redisTemplate: StringRedisTemplate,
    @Value("\${tracking.query.live-cache.key-prefix:aircraft:}")
    private val keyPrefix: String,
    @Value("\${tracking.query.live-cache.index-key:aircraft:index}")
    private val indexKey: String,
    @Value("\${tracking.query.live-cache.geo-key:aircraft:geo}")
    private val geoKey: String,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(fixedRateString = "\${tracking.query.live-cache.cleanup-interval-ms:60000}")
    public fun cleanupStaleEntries() {
        val allIcaos = redisTemplate.opsForSet().members(indexKey) ?: return
        var removed = 0
        for (icao in allIcaos) {
            if (redisTemplate.hasKey("$keyPrefix$icao") != true) {
                redisTemplate.opsForSet().remove(indexKey, icao)
                redisTemplate.opsForZSet().remove(geoKey, icao)
                removed++
            }
        }
        if (removed > 0) {
            log.debug("Cleaned up {} stale entries from {}", removed, indexKey)
        }
    }
}
