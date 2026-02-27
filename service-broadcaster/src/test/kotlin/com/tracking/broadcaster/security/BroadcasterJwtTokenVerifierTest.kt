package com.tracking.broadcaster.security

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.nulls.shouldNotBeNull
import io.jsonwebtoken.Jwts
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.PublicKey
import java.time.Instant
import java.util.Date
import kotlin.test.Test

public class BroadcasterJwtTokenVerifierTest {
    private val objectMapper = jacksonObjectMapper()
    private val keyPair: KeyPair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
    private val properties = BroadcasterSecurityProperties().apply { jwtIssuer = "tracking-auth" }

    @Test
    public fun `should refresh jwks on cache miss and verify token`() {
        val provider = RefreshingProvider(expectedKid = "kid-refresh", refreshedKey = keyPair.public)
        val verifier = BroadcasterJwtTokenVerifier(provider, objectMapper, properties)
        val token = signedToken(kid = "kid-refresh", subject = "alice")

        val principal = verifier.verify(token)

        principal.shouldNotBeNull()
        principal.subject shouldBe "alice"
        provider.refreshCalls shouldBe 1
    }

    private fun signedToken(kid: String, subject: String): String {
        return Jwts.builder()
            .header()
            .keyId(kid)
            .and()
            .issuer("tracking-auth")
            .subject(subject)
            .id("token-$subject")
            .claim("roles", listOf("ROLE_USER"))
            .expiration(Date.from(Instant.now().plusSeconds(120)))
            .signWith(keyPair.private)
            .compact()
    }

    private class RefreshingProvider(
        private val expectedKid: String,
        private val refreshedKey: PublicKey,
    ) : JwksKeyProvider {
        public var refreshCalls: Int = 0

        override fun resolveCachedKey(kid: String): PublicKey? = null

        override fun refreshAndResolveKey(kid: String): PublicKey? {
            refreshCalls += 1
            return if (kid == expectedKid) refreshedKey else null
        }
    }
}
