package com.tracking.ingestion.security

import com.github.benmanes.caffeine.cache.Cache
import com.github.benmanes.caffeine.cache.Caffeine
import com.tracking.ingestion.config.IngestionProperties
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.HexFormat
import java.util.concurrent.TimeUnit
import org.springframework.stereotype.Component

@Component
public class ApiKeyCacheService(
    ingestionProperties: IngestionProperties,
) {
    private val revocationTtlSeconds: Long = ingestionProperties.security.revocationSourceTtlSeconds
    private val cache: Cache<String, ApiKeyPrincipal> = Caffeine.newBuilder()
        .expireAfterWrite(ingestionProperties.security.cacheTtlSeconds, TimeUnit.SECONDS)
        .maximumSize(100_000)
        .build()
    private val revokedSourceIds: Cache<String, Boolean> = Caffeine.newBuilder()
        .expireAfterWrite(revocationTtlSeconds, TimeUnit.SECONDS)
        .maximumSize(200_000)
        .build()

    public fun getIfPresent(apiKey: String): ApiKeyPrincipal? {
        val cached = cache.getIfPresent(fingerprint(apiKey)) ?: return null
        if (isSourceRevoked(cached.sourceId)) {
            return null
        }

        return cached
    }

    public fun cache(apiKey: String, principal: ApiKeyPrincipal) {
        if (isSourceRevoked(principal.sourceId)) {
            return
        }

        cache.put(fingerprint(apiKey), principal)
    }

    public fun revokeSourceId(sourceId: String) {
        revokedSourceIds.put(sourceId, true)
    }

    public fun isSourceRevoked(sourceId: String): Boolean {
        return revokedSourceIds.getIfPresent(sourceId) == true
    }

    private fun fingerprint(apiKey: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(apiKey.toByteArray(StandardCharsets.UTF_8))
        return HexFormat.of().formatHex(digest)
    }
}
