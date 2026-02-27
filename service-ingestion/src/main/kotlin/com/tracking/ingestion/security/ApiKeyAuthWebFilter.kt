package com.tracking.ingestion.security

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.ingestion.config.IngestionProperties
import com.tracking.ingestion.metrics.IngestionMetrics
import java.time.Instant
import org.springframework.core.Ordered
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.server.PathContainer
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import org.springframework.web.server.WebFilter
import org.springframework.web.server.WebFilterChain
import org.springframework.web.util.pattern.PathPattern
import org.springframework.web.util.pattern.PathPatternParser
import reactor.core.publisher.Mono

@Component
public class ApiKeyAuthWebFilter(
    private val ingestionProperties: IngestionProperties,
    private val apiKeyCacheService: ApiKeyCacheService,
    private val authServiceClient: AuthServiceClient,
    private val ingestionMetrics: IngestionMetrics,
    private val objectMapper: ObjectMapper,
) : WebFilter, Ordered {
    private val pathPatternParser: PathPatternParser = PathPatternParser.defaultInstance
    private val ingestPathPattern: PathPattern by lazy { pathPatternParser.parse(ingestionProperties.ingestPath) }

    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE + 40

    override fun filter(exchange: ServerWebExchange, chain: WebFilterChain): Mono<Void> {
        val securityProperties = ingestionProperties.security
        if (!securityProperties.enforceApiKey) {
            return chain.filter(exchange)
        }

        val requestPath = PathContainer.parsePath(exchange.request.path.value())
        if (!ingestPathPattern.matches(requestPath)) {
            return chain.filter(exchange)
        }

        val apiKeyHeader = securityProperties.apiKeyHeader
        val apiKey = exchange.request.headers.getFirst(apiKeyHeader)?.trim().orEmpty().ifBlank { null }
            ?: return unauthorized(exchange, "API_KEY_REJECTED", "Missing $apiKeyHeader header.")

        val cachedPrincipal = apiKeyCacheService.getIfPresent(apiKey)
        if (cachedPrincipal != null) {
            return continueWithPrincipal(exchange, chain, cachedPrincipal)
        }

        return authServiceClient.verifyApiKey(apiKey)
            .flatMap { principal ->
                if (apiKeyCacheService.isSourceRevoked(principal.sourceId)) {
                    return@flatMap unauthorized(exchange, "API_KEY_REJECTED", "API key source has been revoked.")
                }

                apiKeyCacheService.cache(apiKey, principal)
                continueWithPrincipal(exchange, chain, principal)
            }
            .switchIfEmpty(unauthorized(exchange, "API_KEY_REJECTED", "API key verification failed."))
    }

    private fun continueWithPrincipal(
        exchange: ServerWebExchange,
        chain: WebFilterChain,
        principal: ApiKeyPrincipal,
    ): Mono<Void> {
        val sourceIdHeader = ingestionProperties.security.sourceIdHeader
        val request = exchange.request.mutate()
            .header(sourceIdHeader, principal.sourceId)
            .build()
        return chain.filter(exchange.mutate().request(request).build())
    }

    private fun unauthorized(exchange: ServerWebExchange, code: String, message: String): Mono<Void> {
        ingestionMetrics.incrementAuthRejected()
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
}
