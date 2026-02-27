package com.tracking.auth.security

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest

@DataJpaTest(
    properties = [
        "spring.flyway.enabled=false",
    ],
)
public class JwksKeyProviderPersistenceIT {
    @Autowired
    private lateinit var jwtSigningKeyRepository: JwtSigningKeyRepository

    @Test
    public fun `should persist active signing key and load it after provider restart`() {
        val encryptionService = EncryptionService(TEST_MASTER_KEY)
        val firstProvider = JwksKeyProvider(
            encryptionService = encryptionService,
            jwtSigningKeyRepository = jwtSigningKeyRepository,
            maxRetainedKeys = 5,
        )
        val firstJwtService = JwtService(firstProvider)
        val firstActiveKid = firstProvider.activeKid()
        val token = firstJwtService.generateAccessToken("alice", setOf("ROLE_USER"))

        val secondProvider = JwksKeyProvider(
            encryptionService = encryptionService,
            jwtSigningKeyRepository = jwtSigningKeyRepository,
            maxRetainedKeys = 5,
        )
        val secondJwtService = JwtService(secondProvider)

        assertEquals(firstActiveKid, secondProvider.activeKid())
        assertNotNull(secondProvider.findPublicKeyByKid(firstActiveKid))
        assertTrue(secondJwtService.isTokenValid(token, "alice"))
    }

    private companion object {
        private const val TEST_MASTER_KEY: String = "abcdefghijklmnopqrstuvwxyz123456"
    }
}
