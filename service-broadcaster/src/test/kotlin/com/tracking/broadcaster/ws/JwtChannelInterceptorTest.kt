package com.tracking.broadcaster.ws

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.tracking.broadcaster.metrics.BroadcasterMetrics
import com.tracking.broadcaster.security.BroadcasterBlacklistService
import com.tracking.broadcaster.security.BroadcasterJwtTokenVerifier
import com.tracking.broadcaster.security.BroadcasterSecurityProperties
import com.tracking.broadcaster.security.JwksKeyProvider
import io.jsonwebtoken.Jwts
import io.kotest.matchers.shouldBe
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.time.Instant
import java.util.Date
import kotlin.test.Test
import kotlin.test.assertFailsWith
import org.springframework.messaging.Message
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.MessageDeliveryException
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor

public class JwtChannelInterceptorTest {
    private val objectMapper = jacksonObjectMapper()
    private val keyPair: KeyPair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
    private val securityProperties = BroadcasterSecurityProperties().apply { jwtIssuer = "tracking-auth" }

    @Test
    public fun `should allow stomp connect when jwt is valid`() {
        val meterRegistry = SimpleMeterRegistry()
        val interceptor = interceptor(meterRegistry, revokedUser = null)
        val token = signedToken(subject = "alice", expiresAt = Instant.now().plusSeconds(120))
        val message = connectMessage(token)

        val result = interceptor.preSend(message, NoopChannel) ?: error("CONNECT should pass")

        val accessor = StompHeaderAccessor.wrap(result)
        accessor.user?.name shouldBe "alice"
        meterRegistry.counter("ws.sessions.rejected_jwt").count() shouldBe 0.0
    }

    @Test
    public fun `should reject stomp connect when token missing`() {
        val meterRegistry = SimpleMeterRegistry()
        val interceptor = interceptor(meterRegistry, revokedUser = null)

        assertFailsWith<MessageDeliveryException> {
            interceptor.preSend(connectMessage(null), NoopChannel)
        }

        meterRegistry.counter("ws.sessions.rejected_jwt").count() shouldBe 1.0
    }

    @Test
    public fun `should reject stomp connect when token expired`() {
        val meterRegistry = SimpleMeterRegistry()
        val interceptor = interceptor(meterRegistry, revokedUser = null)
        val expiredToken = signedToken(subject = "alice", expiresAt = Instant.now().minusSeconds(30))

        assertFailsWith<MessageDeliveryException> {
            interceptor.preSend(connectMessage(expiredToken), NoopChannel)
        }

        meterRegistry.counter("ws.sessions.rejected_jwt").count() shouldBe 1.0
    }

    @Test
    public fun `should reject stomp connect when user revoked`() {
        val meterRegistry = SimpleMeterRegistry()
        val interceptor = interceptor(meterRegistry, revokedUser = "alice")
        val token = signedToken(subject = "alice", expiresAt = Instant.now().plusSeconds(120))

        assertFailsWith<MessageDeliveryException> {
            interceptor.preSend(connectMessage(token), NoopChannel)
        }

        meterRegistry.counter("ws.sessions.rejected_jwt").count() shouldBe 1.0
    }

    private fun interceptor(meterRegistry: SimpleMeterRegistry, revokedUser: String?): JwtChannelInterceptor {
        val keyProvider = JwksKeyProvider { kid -> if (kid == "kid-1") keyPair.public else null }
        val verifier = BroadcasterJwtTokenVerifier(keyProvider, objectMapper, securityProperties)
        val blacklist = BroadcasterBlacklistService(securityProperties)
        revokedUser?.let(blacklist::revokeUsername)
        return JwtChannelInterceptor(
            jwtTokenVerifier = verifier,
            blacklistService = blacklist,
            broadcasterMetrics = BroadcasterMetrics(meterRegistry, com.tracking.broadcaster.viewport.ViewportRegistry()),
        )
    }

    private fun signedToken(subject: String, expiresAt: Instant): String {
        return Jwts.builder()
            .header()
            .keyId("kid-1")
            .and()
            .issuer("tracking-auth")
            .subject(subject)
            .id("token-$subject")
            .claim("roles", listOf("ROLE_USER"))
            .expiration(Date.from(expiresAt))
            .signWith(keyPair.private)
            .compact()
    }

    private fun connectMessage(token: String?): Message<ByteArray> {
        val accessor = StompHeaderAccessor.create(StompCommand.CONNECT)
        accessor.sessionId = "session-1"
        token?.let { accessor.setNativeHeader("Authorization", "Bearer $it") }
        return org.springframework.messaging.support.MessageBuilder.createMessage(ByteArray(0), accessor.messageHeaders)
    }

    private object NoopChannel : MessageChannel {
        override fun send(message: Message<*>): Boolean = true

        override fun send(message: Message<*>, timeout: Long): Boolean = true
    }
}
