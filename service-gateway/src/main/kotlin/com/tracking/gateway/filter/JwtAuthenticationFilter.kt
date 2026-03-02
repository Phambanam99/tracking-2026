package com.tracking.gateway.filter

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.gateway.config.GatewayRoutesConfig
import com.tracking.gateway.security.BlacklistService
import com.tracking.gateway.security.TokenPrincipal
import com.tracking.gateway.security.TokenVerifier
import java.time.Instant
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.core.Ordered
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono

@Component
public class JwtAuthenticationFilter(
    private val routesConfig: GatewayRoutesConfig,
    private val tokenVerifier: TokenVerifier,
    private val blacklistService: BlacklistService,
    private val objectMapper: ObjectMapper,
) : GlobalFilter, Ordered {
    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE + 50

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val request = exchange.request
        if (request.method == HttpMethod.OPTIONS) {
            return chain.filter(exchange)
        }

        val path = request.path.value()
        if (!routesConfig.requiresJwt(path)) {
            return chain.filter(exchange)
        }

        val token = extractBearerToken(request.headers.getFirst(AUTHORIZATION_HEADER))
            ?: extractWebsocketQueryToken(exchange)
            ?: return unauthorized(exchange, "JWT_MISSING", "Missing or invalid Bearer token.")

        return tokenVerifier.verify(token)
            .switchIfEmpty(Mono.error(AuthenticationRejectedException("JWT_INVALID", "JWT verification failed.")))
            .flatMap { principal ->
                if (isRevoked(principal)) {
                    return@flatMap Mono.error(AuthenticationRejectedException("JWT_REVOKED", "JWT has been revoked."))
                }

                val mutatedRequest = request.mutate()
                    .header(HEADER_AUTH_USER, principal.subject)
                    .header(HEADER_AUTH_ROLES, principal.roles.joinToString(","))
                    .header(HEADER_AUTH_TOKEN_ID, principal.tokenId)
                    .build()

                chain.filter(exchange.mutate().request(mutatedRequest).build())
            }
            .onErrorResume(AuthenticationRejectedException::class.java) { error ->
                unauthorized(exchange, error.code, error.message ?: "Authentication failed.")
            }
    }

    public fun extractBearerToken(header: String?): String? {
        if (header == null) {
            return null
        }

        if (!header.startsWith(BEARER_PREFIX)) {
            return null
        }

        val token = header.removePrefix(BEARER_PREFIX).trim()
        return token.takeIf { it.isNotEmpty() }
    }

    private fun extractWebsocketQueryToken(exchange: ServerWebExchange): String? {
        val request = exchange.request
        if (!isWebsocketRequest(request.path.value())) {
            return null
        }

        val token = request.queryParams.getFirst(WS_ACCESS_TOKEN_QUERY_PARAM)?.trim()
        if (token.isNullOrBlank()) {
            return null
        }

        return token.removePrefix(BEARER_PREFIX).trim().takeIf { it.isNotEmpty() }
    }

    private fun isWebsocketRequest(path: String): Boolean {
        if (routesConfig.isWebsocketPath(path)) {
            return true
        }

        val configuredPrefix = routesConfig.websocketPath.removeSuffix("/**")
        return path == configuredPrefix || path.startsWith("$configuredPrefix/")
    }

    private fun isRevoked(principal: TokenPrincipal): Boolean {
        if (principal.expiresAt.isBefore(Instant.now())) {
            return true
        }

        if (blacklistService.isTokenRevoked(principal.tokenId)) {
            return true
        }

        return blacklistService.isUserRevoked(principal.subject)
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
        private const val AUTHORIZATION_HEADER: String = "Authorization"
        private const val BEARER_PREFIX: String = "Bearer "
        private const val WS_ACCESS_TOKEN_QUERY_PARAM: String = "access_token"
        private const val HEADER_AUTH_USER: String = "X-Auth-User"
        private const val HEADER_AUTH_ROLES: String = "X-Auth-Roles"
        private const val HEADER_AUTH_TOKEN_ID: String = "X-Auth-Token-Id"
    }

    private class AuthenticationRejectedException(
        val code: String,
        message: String,
    ) : RuntimeException(message)
}
