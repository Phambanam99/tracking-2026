package com.tracking.gateway.filter

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.gateway.config.GatewayRoutesConfig
import com.tracking.gateway.security.ApiKeyVerifier
import com.tracking.gateway.security.BlacklistService
import java.time.Instant
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.core.Ordered
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono

@Component
public class ApiKeyFilter(
    private val routesConfig: GatewayRoutesConfig,
    private val apiKeyVerificationService: ApiKeyVerifier,
    private val blacklistService: BlacklistService,
    private val objectMapper: ObjectMapper,
) : GlobalFilter, Ordered {
    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE + 60

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val path = exchange.request.path.value()
        if (!routesConfig.requiresApiKey(path)) {
            return chain.filter(exchange)
        }

        val apiKey = extractApiKey(exchange.request.headers.getFirst(API_KEY_HEADER))
            ?: return unauthorized(exchange, "API_KEY_MISSING", "Missing x-api-key header.")

        if (blacklistService.isApiKeyRevoked(apiKey)) {
            return unauthorized(exchange, "API_KEY_REVOKED", "API key has been revoked.")
        }

        return apiKeyVerificationService.verify(apiKey)
            .switchIfEmpty(Mono.error(AuthenticationRejectedException("API_KEY_INVALID", "API key verification failed.")))
            .flatMap { principal ->
                if (blacklistService.isApiKeyRevoked(apiKey, principal.sourceId)) {
                    return@flatMap Mono.error(AuthenticationRejectedException("API_KEY_REVOKED", "API key has been revoked."))
                }

                val mutatedRequest = exchange.request.mutate()
                    .header(HEADER_SOURCE_ID, principal.sourceId)
                    .build()
                chain.filter(exchange.mutate().request(mutatedRequest).build())
            }
            .onErrorResume(AuthenticationRejectedException::class.java) { error ->
                unauthorized(exchange, error.code, error.message ?: "Authentication failed.")
            }
    }

    public fun extractApiKey(headerValue: String?): String? {
        val normalized = headerValue?.trim().orEmpty()
        return normalized.takeIf { it.isNotEmpty() }
    }

    private fun unauthorized(exchange: ServerWebExchange, code: String, message: String): Mono<Void> {
        if (exchange.response.isCommitted) {
            return Mono.empty()
        }

        val payload = mapOf(
            "timestamp" to Instant.now().toString(),
            "status" to HttpStatus.UNAUTHORIZED.value(),
            "error" to HttpStatus.UNAUTHORIZED.reasonPhrase,
            "code" to code,
            "message" to message,
            "path" to exchange.request.path.value(),
        )
        val bytes = objectMapper.writeValueAsBytes(payload)
        exchange.response.statusCode = HttpStatus.UNAUTHORIZED
        exchange.response.headers.contentType = MediaType.APPLICATION_JSON
        val buffer = exchange.response.bufferFactory().wrap(bytes)
        return exchange.response.writeWith(Mono.just(buffer))
    }

    private companion object {
        private const val API_KEY_HEADER: String = "x-api-key"
        private const val HEADER_SOURCE_ID: String = "X-Source-Id"
    }

    private class AuthenticationRejectedException(
        val code: String,
        message: String,
    ) : RuntimeException(message)
}
