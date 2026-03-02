package com.tracking.gateway.filter

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.gateway.config.GatewayRoutesConfig
import com.tracking.gateway.security.BlacklistService
import com.tracking.gateway.security.GatewaySecurityProperties
import com.tracking.gateway.security.TokenPrincipal
import com.tracking.gateway.security.TokenVerifier
import java.time.Instant
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono

public class JwtAuthenticationFilterTest {
    @Test
    public fun `should extract jwt from bearer header`() {
        val filter = buildFilter(tokenVerifier = FixedTokenVerifier(validPrincipal()))

        assertEquals("jwt-token", filter.extractBearerToken("Bearer jwt-token"))
    }

    @Test
    public fun `should return null when header is invalid`() {
        val filter = buildFilter(tokenVerifier = FixedTokenVerifier(validPrincipal()))

        assertEquals(null, filter.extractBearerToken("Basic abc"))
        assertEquals(null, filter.extractBearerToken(null))
    }

    @Test
    public fun `should reject protected route when jwt missing`() {
        val filter = buildFilter(tokenVerifier = FixedTokenVerifier(validPrincipal()))
        val exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/api/v1/auth/profile").build())
        val chain = CapturingChain()

        filter.filter(exchange, chain).block()

        assertFalse(chain.invoked)
        assertEquals(401, exchange.response.statusCode?.value())
    }

    @Test
    public fun `should pass request and attach principal headers when jwt valid`() {
        val filter = buildFilter(tokenVerifier = FixedTokenVerifier(validPrincipal()))
        val exchange = MockServerWebExchange.from(
            MockServerHttpRequest.get("/api/v1/auth/profile")
                .header("Authorization", "Bearer valid-jwt")
                .build(),
        )
        val chain = CapturingChain()

        filter.filter(exchange, chain).block()

        assertTrue(chain.invoked)
        assertEquals("alice", chain.capturedExchange?.request?.headers?.getFirst("X-Auth-User"))
        assertEquals("ROLE_USER", chain.capturedExchange?.request?.headers?.getFirst("X-Auth-Roles"))
        assertEquals("token-1", chain.capturedExchange?.request?.headers?.getFirst("X-Auth-Token-Id"))
    }

    @Test
    public fun `should accept websocket jwt from query parameter access_token`() {
        val filter = buildFilter(tokenVerifier = FixedTokenVerifier(validPrincipal()))
        val exchange = MockServerWebExchange.from(
            MockServerHttpRequest.get("/ws/live")
                .queryParam("access_token", "valid-jwt")
                .build(),
        )
        val chain = CapturingChain()

        filter.filter(exchange, chain).block()

        assertTrue(chain.invoked)
        assertEquals("alice", chain.capturedExchange?.request?.headers?.getFirst("X-Auth-User"))
    }

    @Test
    public fun `should accept websocket query token when protected path uses exact websocket route`() {
        val filter = buildFilter(
            tokenVerifier = FixedTokenVerifier(validPrincipal()),
            routesConfig = GatewayRoutesConfig(
                websocketPath = "/ws/live/**",
                jwtProtectedPaths = listOf("/ws/live"),
            ),
        )
        val exchange = MockServerWebExchange.from(
            MockServerHttpRequest.get("/ws/live")
                .queryParam("access_token", "valid-jwt")
                .build(),
        )
        val chain = CapturingChain()

        filter.filter(exchange, chain).block()

        assertTrue(chain.invoked)
    }

    private fun buildFilter(
        tokenVerifier: TokenVerifier,
        routesConfig: GatewayRoutesConfig = GatewayRoutesConfig(),
    ): JwtAuthenticationFilter {
        return JwtAuthenticationFilter(
            routesConfig = routesConfig,
            tokenVerifier = tokenVerifier,
            blacklistService = BlacklistService(GatewaySecurityProperties()),
            objectMapper = ObjectMapper(),
        )
    }

    private fun validPrincipal(): TokenPrincipal {
        return TokenPrincipal(
            subject = "alice",
            roles = setOf("ROLE_USER"),
            tokenId = "token-1",
            expiresAt = Instant.now().plusSeconds(60),
        )
    }

    private class FixedTokenVerifier(
        private val principal: TokenPrincipal?,
    ) : TokenVerifier {
        override fun verify(token: String): Mono<TokenPrincipal> {
            return if (principal == null) Mono.empty() else Mono.just(principal)
        }
    }

    private class CapturingChain : GatewayFilterChain {
        public var invoked: Boolean = false
        public var capturedExchange: ServerWebExchange? = null

        override fun filter(exchange: ServerWebExchange): Mono<Void> {
            invoked = true
            capturedExchange = exchange
            return Mono.empty()
        }
    }
}
