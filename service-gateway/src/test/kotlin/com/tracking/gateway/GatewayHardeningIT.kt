package com.tracking.gateway

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.gateway.config.GatewayRoutesConfig
import com.tracking.gateway.config.RequestSizeConfig
import com.tracking.gateway.config.RequestSizeProperties
import com.tracking.gateway.filter.ApiKeyFilter
import com.tracking.gateway.filter.JwtAuthenticationFilter
import com.tracking.gateway.filter.TraceIdFilter
import com.tracking.gateway.security.ApiKeyPrincipal
import com.tracking.gateway.security.ApiKeyVerifier
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

public class GatewayHardeningIT {
    @Test
    public fun `should propagate trace id and auth principal to downstream`() {
        val traceFilter = TraceIdFilter()
        val jwtFilter = JwtAuthenticationFilter(
            routesConfig = GatewayRoutesConfig(),
            tokenVerifier = FixedTokenVerifier(
                TokenPrincipal(
                    subject = "alice",
                    roles = setOf("ROLE_USER"),
                    tokenId = "token-1",
                    expiresAt = Instant.now().plusSeconds(60),
                ),
            ),
            blacklistService = BlacklistService(GatewaySecurityProperties()),
            objectMapper = ObjectMapper(),
        )
        val terminalChain = CapturingChain()
        val exchange = MockServerWebExchange.from(
            MockServerHttpRequest.get("/api/v1/auth/profile")
                .header("Authorization", "Bearer jwt-value")
                .build(),
        )

        traceFilter.filter(exchange, GatewayFilterChain { traced ->
            jwtFilter.filter(traced, terminalChain)
        }).block()

        assertTrue(terminalChain.invoked)
        assertEquals("alice", terminalChain.exchange?.request?.headers?.getFirst("X-Auth-User"))
        assertEquals("token-1", terminalChain.exchange?.request?.headers?.getFirst("X-Auth-Token-Id"))
        assertTrue(exchange.response.headers.getFirst("x-request-id").isNullOrBlank().not())
    }

    @Test
    public fun `should reject oversized ingest payload before api key verify`() {
        val requestSizeFilter = RequestSizeConfig(
            properties = RequestSizeProperties(
                defaultMaxBytes = 1024,
                perPath = mapOf("/api/v1/ingest/**" to 128),
            ),
            objectMapper = ObjectMapper(),
        )
        val apiKeyFilter = ApiKeyFilter(
            routesConfig = GatewayRoutesConfig(),
            apiKeyVerificationService = FixedApiKeyVerifier(ApiKeyPrincipal(sourceId = "SRC-1")),
            blacklistService = BlacklistService(GatewaySecurityProperties()),
            objectMapper = ObjectMapper(),
        )
        val terminalChain = CapturingChain()
        val exchange = MockServerWebExchange.from(
            MockServerHttpRequest.post("/api/v1/ingest/events")
                .header("x-api-key", "key-1")
                .header("Content-Length", "256")
                .build(),
        )

        requestSizeFilter.filter(exchange, GatewayFilterChain { sized ->
            apiKeyFilter.filter(sized, terminalChain)
        }).block()

        assertFalse(terminalChain.invoked)
        assertEquals(413, exchange.response.statusCode?.value())
    }

    private class CapturingChain : GatewayFilterChain {
        public var invoked: Boolean = false
        public var exchange: ServerWebExchange? = null

        override fun filter(exchange: ServerWebExchange): Mono<Void> {
            invoked = true
            this.exchange = exchange
            return Mono.empty()
        }
    }

    private class FixedTokenVerifier(
        private val principal: TokenPrincipal?,
    ) : TokenVerifier {
        override fun verify(token: String): Mono<TokenPrincipal> {
            return if (principal == null) Mono.empty() else Mono.just(principal)
        }
    }

    private class FixedApiKeyVerifier(
        private val principal: ApiKeyPrincipal?,
    ) : ApiKeyVerifier {
        override fun verify(apiKey: String): Mono<ApiKeyPrincipal> {
            return if (principal == null) Mono.empty() else Mono.just(principal)
        }
    }
}
