package com.tracking.auth.security

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.Instant

public class JwtServiceTest {
    private val encryptionService: EncryptionService = EncryptionService(TEST_MASTER_KEY)
    private val jwksKeyProvider: JwksKeyProvider = JwksKeyProvider(encryptionService = encryptionService)
    private val jwtService: JwtService = JwtService(jwksKeyProvider)

    @Test
    public fun `should generate valid access token with roles`() {
        val token = jwtService.generateAccessToken(
            username = "alice",
            roles = setOf("ROLE_USER", "ROLE_ADMIN"),
            ttl = Duration.ofMinutes(5),
        )

        assertTrue(jwtService.isTokenValid(token, "alice"))
        assertEquals("alice", jwtService.extractUsername(token))
        assertEquals(setOf("ROLE_USER", "ROLE_ADMIN"), jwtService.extractRoles(token))
        assertFalse(jwtService.isRefreshToken(token))
        assertNotNull(jwtService.extractTokenId(token))
        assertTrue(jwtService.extractExpiration(token)?.isAfter(Instant.now()) == true)
    }

    @Test
    public fun `should generate refresh token and mark token type correctly`() {
        val tokenId = "refresh-jti-001"
        val token = jwtService.generateRefreshToken(
            username = "alice",
            tokenId = tokenId,
            ttl = Duration.ofDays(7),
        )

        assertTrue(jwtService.isTokenValid(token, "alice"))
        assertTrue(jwtService.isRefreshToken(token))
        assertEquals("alice", jwtService.extractUsername(token))
        assertEquals(tokenId, jwtService.extractTokenId(token))
        assertEquals(emptySet<String>(), jwtService.extractRoles(token))
    }

    @Test
    public fun `should keep token valid after key rotation during grace window`() {
        val tokenBeforeRotation = jwtService.generateAccessToken("alice", setOf("ROLE_USER"), Duration.ofMinutes(5))

        jwksKeyProvider.rotate()

        assertTrue(jwtService.isTokenValid(tokenBeforeRotation, "alice"))
    }

    @Test
    public fun `should extract token from bearer header only`() {
        assertEquals("token-123", jwtService.extractBearerToken("Bearer token-123"))
        assertEquals(null, jwtService.extractBearerToken("Basic abc"))
        assertEquals(null, jwtService.extractBearerToken(null))
    }

    private companion object {
        private const val TEST_MASTER_KEY: String = "abcdefghijklmnopqrstuvwxyz123456"
    }
}
