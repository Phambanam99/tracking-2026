package com.tracking.gateway.config

import com.fasterxml.jackson.databind.ObjectMapper
import java.time.Instant
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.core.Ordered
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.server.PathContainer
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import org.springframework.web.util.pattern.PathPattern
import org.springframework.web.util.pattern.PathPatternParser
import reactor.core.publisher.Mono

@Component
public class RequestSizeConfig(
    private val properties: RequestSizeProperties,
    private val objectMapper: ObjectMapper,
) : GlobalFilter, Ordered {
    private val parser: PathPatternParser = PathPatternParser.defaultInstance

    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE + 40

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val contentLength = exchange.request.headers.contentLength
        if (contentLength <= 0) {
            return chain.filter(exchange)
        }

        val path = exchange.request.path.value()
        val allowedSize = maxAllowedSize(path)
        if (contentLength <= allowedSize) {
            return chain.filter(exchange)
        }

        return payloadTooLarge(exchange, allowedSize)
    }

    private fun maxAllowedSize(path: String): Long {
        val match = properties.perPath.entries.firstOrNull { (pattern, _) ->
            val pathPattern: PathPattern = parser.parse(pattern)
            pathPattern.matches(PathContainer.parsePath(path))
        }
        return match?.value ?: properties.defaultMaxBytes
    }

    private fun payloadTooLarge(exchange: ServerWebExchange, maxBytes: Long): Mono<Void> {
        val payload = mapOf(
            "timestamp" to Instant.now().toString(),
            "status" to HttpStatus.PAYLOAD_TOO_LARGE.value(),
            "error" to HttpStatus.PAYLOAD_TOO_LARGE.reasonPhrase,
            "code" to "PAYLOAD_TOO_LARGE",
            "message" to "Request payload exceeds $maxBytes bytes.",
            "path" to exchange.request.path.value(),
        )

        val bytes = objectMapper.writeValueAsBytes(payload)
        exchange.response.statusCode = HttpStatus.PAYLOAD_TOO_LARGE
        exchange.response.headers.contentType = MediaType.APPLICATION_JSON
        val buffer = exchange.response.bufferFactory().wrap(bytes)
        return exchange.response.writeWith(Mono.just(buffer))
    }
}

@ConfigurationProperties(prefix = "tracking.gateway.request-size")
public class RequestSizeProperties(
    public var defaultMaxBytes: Long = 1_048_576,
    public var perPath: Map<String, Long> = mapOf(
        "/api/v1/ingest/**" to 262_144,
        "/api/v1/auth/**" to 65_536,
    ),
)
