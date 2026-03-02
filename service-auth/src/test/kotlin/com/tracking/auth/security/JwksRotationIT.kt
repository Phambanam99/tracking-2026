package com.tracking.auth.security

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

public class JwksRotationIT {
    @Test
    public fun `should publish both old and new keys after rotation`() {
        val provider = JwksKeyProvider(encryptionService = EncryptionService(TEST_MASTER_KEY))
        val jwtService = JwtService(provider)
        val firstKid = provider.activeKid()
        val tokenFromFirstKey = jwtService.generateAccessToken(1L, "alice", setOf("ROLE_USER"))

        val secondKid = provider.rotate()
        val tokenFromSecondKey = jwtService.generateAccessToken(1L, "alice", setOf("ROLE_USER"))

        val jwks = provider.jwks()
        val keys = (jwks["keys"] as List<*>).filterIsInstance<Map<String, Any>>()
        val keyIds = keys.mapNotNull { key -> key["kid"] as? String }

        assertNotEquals(firstKid, secondKid)
        assertTrue(keyIds.contains(firstKid))
        assertTrue(keyIds.contains(secondKid))
        assertTrue(jwtService.isTokenValid(tokenFromFirstKey, "alice"))
        assertTrue(jwtService.isTokenValid(tokenFromSecondKey, "alice"))
        assertEquals(2, keyIds.toSet().size)
        assertNotNull(provider.findPublicKeyByKid(firstKid))
        assertNotNull(provider.findPublicKeyByKid(secondKid))
    }

    private companion object {
        private const val TEST_MASTER_KEY: String = "abcdefghijklmnopqrstuvwxyz123456"
    }
}
