package com.tracking.ingestion.api

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.ingestion.config.IngestionProperties
import com.tracking.ingestion.metrics.IngestionMetrics
import java.time.Instant
import java.util.concurrent.Semaphore
import org.springframework.beans.factory.annotation.Qualifier
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
public class AdmissionControlFilter(
    private val ingestionProperties: IngestionProperties,
    @Qualifier("ingestionAdmissionSemaphore")
    private val semaphore: Semaphore,
    private val ingestionMetrics: IngestionMetrics,
    private val objectMapper: ObjectMapper,
) : WebFilter, Ordered {
    private val pathPatternParser: PathPatternParser = PathPatternParser.defaultInstance
    private val ingestPathPattern: PathPattern by lazy { pathPatternParser.parse(ingestionProperties.ingestPath) }

    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE + 30

    override fun filter(exchange: ServerWebExchange, chain: WebFilterChain): Mono<Void> {
        val requestPath = PathContainer.parsePath(exchange.request.path.value())
        if (!ingestPathPattern.matches(requestPath)) {
            return chain.filter(exchange)
        }

        if (!semaphore.tryAcquire()) {
            ingestionMetrics.incrementAdmissionRejected()
            return tooManyRequests(exchange)
        }

        return chain.filter(exchange).doFinally {
            semaphore.release()
        }
    }

    private fun tooManyRequests(exchange: ServerWebExchange): Mono<Void> {
        val payload = mapOf(
            "timestamp" to Instant.now().toString(),
            "status" to HttpStatus.TOO_MANY_REQUESTS.value(),
            "error" to HttpStatus.TOO_MANY_REQUESTS.reasonPhrase,
            "code" to "INGEST_ADMISSION_REJECTED",
            "message" to "Ingestion admission limit reached.",
            "path" to exchange.request.path.value(),
        )
        val bytes = objectMapper.writeValueAsBytes(payload)
        exchange.response.statusCode = HttpStatus.TOO_MANY_REQUESTS
        exchange.response.headers.contentType = MediaType.APPLICATION_JSON
        val buffer = exchange.response.bufferFactory().wrap(bytes)
        return exchange.response.writeWith(Mono.just(buffer))
    }
}
