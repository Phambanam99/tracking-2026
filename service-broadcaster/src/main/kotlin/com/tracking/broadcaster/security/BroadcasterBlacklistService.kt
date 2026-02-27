package com.tracking.broadcaster.security

import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.max
import org.springframework.stereotype.Component

@Component
public class BroadcasterBlacklistService(
    private val securityProperties: BroadcasterSecurityProperties,
) {
    private val revokedTokenIds: MutableMap<String, Instant> = ConcurrentHashMap()
    private val revokedUsers: MutableMap<String, Instant> = ConcurrentHashMap()

    public fun revokeTokenId(tokenId: String, expiresAt: Instant): Unit {
        revokedTokenIds[tokenId] = expiresAt
    }

    public fun revokeUsername(username: String): Unit {
        val ttlSeconds = max(securityProperties.revocationUserTtlSeconds, securityProperties.accessTokenTtlSeconds)
        revokedUsers[username] = Instant.now().plusSeconds(ttlSeconds)
    }

    public fun isTokenRevoked(tokenId: String): Boolean = isRevoked(revokedTokenIds, tokenId)

    public fun isUserRevoked(username: String): Boolean = isRevoked(revokedUsers, username)

    private fun isRevoked(map: MutableMap<String, Instant>, key: String): Boolean {
        val now = Instant.now()
        val expiresAt = map[key] ?: return false
        if (expiresAt.isBefore(now)) {
            map.remove(key)
            return false
        }
        return true
    }
}
