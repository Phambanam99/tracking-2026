package com.tracking.gateway.config

import com.fasterxml.jackson.databind.ObjectMapper
import java.time.Instant
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.core.Ordered
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono

@Component
public class TlsConfig(
    private val properties: GatewayTlsProperties,
    private val objectMapper: ObjectMapper,
) : GlobalFilter, Ordered {
    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE + 10

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        if (!properties.enforceHttps) {
            return chain.filter(exchange)
        }

        if (isSecureRequest(exchange)) {
            return chain.filter(exchange)
        }

        return reject(exchange, "HTTPS_REQUIRED")
    }

    private fun isSecureRequest(exchange: ServerWebExchange): Boolean {
        val request = exchange.request
        if (request.uri.scheme.equals("https", ignoreCase = true)) {
            return true
        }

        val forwardedProto = request.headers.getFirst("X-Forwarded-Proto")
        return forwardedProto.equals("https", ignoreCase = true)
    }

    private fun reject(exchange: ServerWebExchange, code: String): Mono<Void> {
        val payload = mapOf(
            "timestamp" to Instant.now().toString(),
            "status" to HttpStatus.UPGRADE_REQUIRED.value(),
            "error" to HttpStatus.UPGRADE_REQUIRED.reasonPhrase,
            "code" to code,
            "message" to "Request must use HTTPS.",
            "path" to exchange.request.path.value(),
        )

        val bytes = objectMapper.writeValueAsBytes(payload)
        exchange.response.statusCode = HttpStatus.UPGRADE_REQUIRED
        exchange.response.headers.contentType = MediaType.APPLICATION_JSON
        val buffer = exchange.response.bufferFactory().wrap(bytes)
        return exchange.response.writeWith(Mono.just(buffer))
    }
}

@ConfigurationProperties(prefix = "tracking.gateway.tls")
public class GatewayTlsProperties(
    public var enforceHttps: Boolean = false,
)
