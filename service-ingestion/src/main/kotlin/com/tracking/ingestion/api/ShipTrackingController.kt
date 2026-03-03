package com.tracking.ingestion.api

import com.tracking.ingestion.config.IngestionProperties
import com.tracking.ingestion.kafka.RawAisProducer
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
public class ShipTrackingController(
    private val ingestionProperties: IngestionProperties,
    private val shipIngestRequestValidator: ShipIngestRequestValidator,
    private val rawAisProducer: RawAisProducer,
    private val traceContextExtractor: TraceContextExtractor,
    private val ingestionMetrics: IngestionMetrics,
) {
    @PostMapping("/ais")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public fun ingestSingle(
        @RequestBody request: IngestShipRequest,
        exchange: ServerWebExchange,
    ): Mono<IngestAcceptedResponse> {
        val sourceIdHeader = exchange.request.headers.getFirst(ingestionProperties.security.sourceIdHeader)
        val canonicalShip = shipIngestRequestValidator.validateSingle(request, sourceIdHeader)
        val traceContext = traceContextExtractor.extract(exchange.request)

        return rawAisProducer.publish(canonicalShip, traceContext)
            .doOnSuccess { ingestionMetrics.incrementAcceptedSingle(canonicalShip.sourceId) }
            .thenReturn(IngestAcceptedResponse())
    }

    @PostMapping("/ais/batch")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public fun ingestBatch(
        @RequestBody request: IngestShipBatchRequest,
        exchange: ServerWebExchange,
    ): Mono<IngestBatchResponse> {
        val sourceIdHeader = exchange.request.headers.getFirst(ingestionProperties.security.sourceIdHeader)
        val canonicalShips = shipIngestRequestValidator.validateBatch(request, sourceIdHeader)
        val traceContext = traceContextExtractor.extract(exchange.request)

        return rawAisProducer.publishBatch(canonicalShips, traceContext)
            .doOnSuccess { ingestionMetrics.incrementAcceptedBatchForShips(canonicalShips) }
            .map { accepted -> IngestBatchResponse(accepted = accepted) }
    }
}
