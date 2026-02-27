package com.tracking.gateway.security

import java.time.Instant
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

public class BlacklistServiceTest {
    @Test
    public fun `should mark token id as revoked until expiration`() {
        val service = BlacklistService(GatewaySecurityProperties())
        service.revokeTokenId("token-1", Instant.now().plusMillis(150))

        assertTrue(service.isTokenRevoked("token-1"))
        Thread.sleep(200)
        assertFalse(service.isTokenRevoked("token-1"))
    }

    @Test
    public fun `should keep user revocation ttl not shorter than access token ttl`() {
        val properties = GatewaySecurityProperties(
            accessTokenTtlSeconds = 2,
            revocationUserTtlSeconds = 1,
        )
        val service = BlacklistService(properties)
        service.revokeUsername("alice")

        Thread.sleep(1200)
        assertTrue(service.isUserRevoked("alice"))

        Thread.sleep(1100)
        assertFalse(service.isUserRevoked("alice"))
    }

    @Test
    public fun `should revoke api key by fingerprint and source id`() {
        val service = BlacklistService(GatewaySecurityProperties())
        service.revokeApiKey("key-123")
        service.revokeSourceId("SRC-001")

        assertTrue(service.isApiKeyRevoked("key-123"))
        assertTrue(service.isApiKeyRevoked("another-key", "SRC-001"))
        assertFalse(service.isApiKeyRevoked("another-key", "SRC-999"))
    }
}
