package com.tracking.ingestion.api

import com.tracking.ingestion.config.IngestionProperties
import com.tracking.ingestion.kafka.RawAdsbProducer
import com.tracking.ingestion.metrics.IngestionMetrics
import com.tracking.ingestion.tracing.TraceContextExtractor
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono

@RestController
@RequestMapping("/api/v1/ingest")
public class TrackingController(
    private val ingestionProperties: IngestionProperties,
    private val ingestRequestValidator: IngestRequestValidator,
    private val rawAdsbProducer: RawAdsbProducer,
    private val traceContextExtractor: TraceContextExtractor,
    private val ingestionMetrics: IngestionMetrics,
) {
    @PostMapping("/adsb")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public fun ingestSingle(
        @RequestBody request: IngestFlightRequest,
        exchange: ServerWebExchange,
    ): Mono<IngestAcceptedResponse> {
        val sourceIdHeader = exchange.request.headers.getFirst(ingestionProperties.security.sourceIdHeader)
        val canonicalFlight = ingestRequestValidator.validateSingle(request, sourceIdHeader)
        val traceContext = traceContextExtractor.extract(exchange.request)

        return rawAdsbProducer.publish(canonicalFlight, traceContext)
            .doOnSuccess { ingestionMetrics.incrementAcceptedSingle() }
            .thenReturn(IngestAcceptedResponse())
    }

    @PostMapping("/adsb/batch")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public fun ingestBatch(
        @RequestBody request: IngestBatchRequest,
        exchange: ServerWebExchange,
    ): Mono<IngestBatchResponse> {
        val sourceIdHeader = exchange.request.headers.getFirst(ingestionProperties.security.sourceIdHeader)
        val canonicalFlights = ingestRequestValidator.validateBatch(request, sourceIdHeader)
        val traceContext = traceContextExtractor.extract(exchange.request)

        return rawAdsbProducer.publishBatch(canonicalFlights, traceContext)
            .doOnSuccess { accepted -> ingestionMetrics.incrementAcceptedBatch(accepted) }
            .map { accepted -> IngestBatchResponse(accepted = accepted) }
    }
}
