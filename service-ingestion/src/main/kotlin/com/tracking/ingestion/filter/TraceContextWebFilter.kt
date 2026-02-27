package com.tracking.ingestion.filter

import com.tracking.ingestion.tracing.TraceContextExtractor
import java.security.SecureRandom
import java.util.HexFormat
import java.util.UUID
import org.springframework.core.Ordered
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import org.springframework.web.server.WebFilter
import org.springframework.web.server.WebFilterChain
import reactor.core.publisher.Mono

@Component
public class TraceContextWebFilter : WebFilter, Ordered {
    private val random: SecureRandom = SecureRandom()

    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE + 5

    override fun filter(exchange: ServerWebExchange, chain: WebFilterChain): Mono<Void> {
        val requestId = exchange.request.headers.getFirst(TraceContextExtractor.HEADER_REQUEST_ID)
            ?.trim()
            .orEmpty()
            .ifBlank { UUID.randomUUID().toString() }
        val traceparent = exchange.request.headers.getFirst(TraceContextExtractor.HEADER_TRACEPARENT)
            ?.trim()
            .orEmpty()
            .ifBlank { generateTraceparent() }

        val mutatedRequest = exchange.request.mutate()
            .header(TraceContextExtractor.HEADER_REQUEST_ID, requestId)
            .header(TraceContextExtractor.HEADER_TRACEPARENT, traceparent)
            .build()
        val mutatedExchange = exchange.mutate().request(mutatedRequest).build()
        mutatedExchange.response.headers.set(TraceContextExtractor.HEADER_REQUEST_ID, requestId)
        mutatedExchange.response.headers.set(TraceContextExtractor.HEADER_TRACEPARENT, traceparent)
        return chain.filter(mutatedExchange)
    }

    private fun generateTraceparent(): String {
        val traceId = randomHex(16)
        val spanId = randomHex(8)
        return "00-$traceId-$spanId-01"
    }

    private fun randomHex(byteLength: Int): String {
        val bytes = ByteArray(byteLength)
        random.nextBytes(bytes)
        return HexFormat.of().formatHex(bytes)
    }
}
