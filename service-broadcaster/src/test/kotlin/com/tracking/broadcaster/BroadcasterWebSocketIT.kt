package com.tracking.broadcaster

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.tracking.broadcaster.metrics.BroadcasterMetrics
import com.tracking.broadcaster.security.BroadcasterBlacklistService
import com.tracking.broadcaster.security.BroadcasterJwtTokenVerifier
import com.tracking.broadcaster.security.BroadcasterSecurityProperties
import com.tracking.broadcaster.security.JwksKeyProvider
import com.tracking.broadcaster.spatial.BoundingBoxMatcher
import com.tracking.broadcaster.spatial.SpatialPushEngine
import com.tracking.broadcaster.viewport.ViewportMessageHandler
import com.tracking.broadcaster.viewport.ViewportRegistry
import com.tracking.broadcaster.viewport.ViewportSession
import com.tracking.broadcaster.ws.JwtChannelInterceptor
import com.tracking.broadcaster.ws.SessionFlightPusher
import com.tracking.broadcaster.ws.SessionRateLimiter
import com.tracking.common.dto.AircraftMetadata
import com.tracking.common.dto.BoundingBox
import com.tracking.common.dto.EnrichedFlight
import io.jsonwebtoken.Jwts
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.time.Instant
import java.util.Date
import java.util.Optional
import kotlin.test.Test
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.messaging.Message
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor

public class BroadcasterWebSocketIT {
    private val objectMapper = jacksonObjectMapper()
    private val keyPair: KeyPair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()

    @Test
    public fun `should pass connect then viewport update and receive matching live flight`() {
        val securityProperties = BroadcasterSecurityProperties().apply { jwtIssuer = "tracking-auth" }
        val keyProvider = JwksKeyProvider { kid -> if (kid == "kid-1") keyPair.public else null }
        val verifier = BroadcasterJwtTokenVerifier(keyProvider, objectMapper, securityProperties)
        val blacklist = BroadcasterBlacklistService(securityProperties)
        val registry = ViewportRegistry()
        val metrics = BroadcasterMetrics(SimpleMeterRegistry(), registry)
        val jwtInterceptor = JwtChannelInterceptor(verifier, blacklist, metrics)
        val rateLimiter = SessionRateLimiter(maxRequestsPerWindow = 10, windowMillis = 60_000)
        val viewportHandler = ViewportMessageHandler(registry, rateLimiter, metrics)

        val pushed: MutableList<Pair<ViewportSession, EnrichedFlight>> = mutableListOf()
        val spatialEngine = SpatialPushEngine(
            viewportRegistry = registry,
            boundingBoxMatcher = BoundingBoxMatcher(),
            sessionFlightPusher = SessionFlightPusher { session, flight ->
                pushed.add(session to flight)
                true
            },
        )
        val consumer = com.tracking.broadcaster.kafka.LiveFlightConsumer(objectMapper, spatialEngine)

        val connectMessage = connectMessage(signedToken("alice"))
        val connected = jwtInterceptor.preSend(connectMessage, NoopChannel) ?: error("CONNECT should pass")
        val principal = StompHeaderAccessor.wrap(connected).user

        viewportHandler.updateViewport(
            viewport = BoundingBox(north = 22.0, south = 20.0, east = 106.0, west = 105.0),
            sessionId = "session-1",
            principal = Optional.ofNullable(principal),
        )

        consumer.consume(ConsumerRecord("live-adsb", 0, 0L, "ICAO123", objectMapper.writeValueAsString(flight(21.0, 105.5))))
        consumer.consume(ConsumerRecord("live-adsb", 0, 1L, "ICAO123", objectMapper.writeValueAsString(flight(30.0, 110.0))))

        pushed shouldHaveSize 1
        pushed.first().first.sessionId shouldBe "session-1"
        pushed.first().second.icao shouldBe "ICAO123"
    }

    private fun signedToken(subject: String): String {
        return Jwts.builder()
            .header()
            .keyId("kid-1")
            .and()
            .issuer("tracking-auth")
            .subject(subject)
            .id("token-$subject")
            .claim("roles", listOf("ROLE_USER"))
            .expiration(Date.from(Instant.now().plusSeconds(120)))
            .signWith(keyPair.private)
            .compact()
    }

    private fun connectMessage(token: String): Message<ByteArray> {
        val accessor = StompHeaderAccessor.create(StompCommand.CONNECT)
        accessor.sessionId = "session-1"
        accessor.setNativeHeader("Authorization", "Bearer $token")
        return org.springframework.messaging.support.MessageBuilder.createMessage(ByteArray(0), accessor.messageHeaders)
    }

    private fun flight(lat: Double, lon: Double): EnrichedFlight =
        EnrichedFlight(
            icao = "ICAO123",
            lat = lat,
            lon = lon,
            eventTime = 1_700_000_000_000,
            sourceId = "radar-1",
            metadata = AircraftMetadata(),
        )

    private object NoopChannel : MessageChannel {
        override fun send(message: Message<*>): Boolean = true

        override fun send(message: Message<*>, timeout: Long): Boolean = true
    }
}
