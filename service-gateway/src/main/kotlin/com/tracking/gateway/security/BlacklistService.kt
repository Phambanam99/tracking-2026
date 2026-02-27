package com.tracking.gateway.security

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Instant
import java.util.HexFormat
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.max
import org.springframework.stereotype.Component

@Component
public class BlacklistService(
    private val securityProperties: GatewaySecurityProperties,
) {
    private val revokedTokenIds: MutableMap<String, Instant> = ConcurrentHashMap()
    private val revokedUsers: MutableMap<String, Instant> = ConcurrentHashMap()
    private val revokedApiKeyFingerprints: MutableMap<String, Instant> = ConcurrentHashMap()
    private val revokedSourceIds: MutableMap<String, Instant> = ConcurrentHashMap()

    public fun revokeTokenId(tokenId: String, expiresAt: Instant) {
        revokedTokenIds[tokenId] = expiresAt
    }

    public fun revokeUsername(username: String) {
        val ttlSeconds = max(securityProperties.revocationUserTtlSeconds, securityProperties.accessTokenTtlSeconds)
        revokedUsers[username] = Instant.now().plusSeconds(ttlSeconds)
    }

    public fun revokeApiKey(apiKey: String) {
        revokedApiKeyFingerprints[fingerprintApiKey(apiKey)] =
            Instant.now().plusSeconds(securityProperties.revocationApiKeyTtlSeconds)
    }

    public fun revokeSourceId(sourceId: String) {
        revokedSourceIds[sourceId] = Instant.now().plusSeconds(securityProperties.revocationApiKeyTtlSeconds)
    }

    public fun isTokenRevoked(tokenId: String): Boolean {
        return isRevoked(revokedTokenIds, tokenId)
    }

    public fun isUserRevoked(username: String): Boolean {
        return isRevoked(revokedUsers, username)
    }

    public fun isApiKeyRevoked(apiKey: String, sourceId: String? = null): Boolean {
        val fingerprintRevoked = isRevoked(revokedApiKeyFingerprints, fingerprintApiKey(apiKey))
        if (fingerprintRevoked) {
            return true
        }

        if (sourceId == null) {
            return false
        }

        return isRevoked(revokedSourceIds, sourceId)
    }

    private fun isRevoked(map: MutableMap<String, Instant>, key: String): Boolean {
        val now = Instant.now()
        val expiresAt = map[key] ?: return false
        if (expiresAt.isBefore(now)) {
            map.remove(key)
            return false
        }

        return true
    }

    private fun fingerprintApiKey(apiKey: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(apiKey.toByteArray(StandardCharsets.UTF_8))
        return HexFormat.of().formatHex(digest)
    }
}
