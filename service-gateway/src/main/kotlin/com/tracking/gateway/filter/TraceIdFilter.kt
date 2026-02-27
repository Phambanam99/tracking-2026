package com.tracking.gateway.filter

import java.security.SecureRandom
import java.util.HexFormat
import java.util.UUID
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.core.Ordered
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono

@Component
public class TraceIdFilter : GlobalFilter, Ordered {
    private val random: SecureRandom = SecureRandom()

    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE + 5

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val incomingRequestId = exchange.request.headers.getFirst(HEADER_REQUEST_ID)?.trim().orEmpty()
        val requestId = incomingRequestId.ifBlank { UUID.randomUUID().toString() }

        val incomingTraceparent = exchange.request.headers.getFirst(HEADER_TRACEPARENT)?.trim().orEmpty()
        val traceparent = incomingTraceparent.ifBlank { generateTraceparent() }

        val mutatedRequest = exchange.request.mutate()
            .header(HEADER_REQUEST_ID, requestId)
            .header(HEADER_TRACEPARENT, traceparent)
            .build()

        val mutatedExchange = exchange.mutate().request(mutatedRequest).build()
        mutatedExchange.response.headers.set(HEADER_REQUEST_ID, requestId)
        mutatedExchange.response.headers.set(HEADER_TRACEPARENT, traceparent)
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

    private companion object {
        private const val HEADER_REQUEST_ID: String = "x-request-id"
        private const val HEADER_TRACEPARENT: String = "traceparent"
    }
}
