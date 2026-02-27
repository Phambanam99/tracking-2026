package com.tracking.ingestion.api

import com.tracking.ingestion.metrics.IngestionMetrics
import java.time.Instant
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.server.ServerWebExchange
import org.springframework.web.server.ServerWebInputException

@RestControllerAdvice
public class GlobalExceptionHandler(
    private val ingestionMetrics: IngestionMetrics,
) {
    @ExceptionHandler(IngestValidationException::class)
    public fun handleValidationException(
        exception: IngestValidationException,
        exchange: ServerWebExchange,
    ): ResponseEntity<IngestionErrorResponse> {
        ingestionMetrics.incrementValidationRejected()
        return error(
            exchange = exchange,
            status = HttpStatus.BAD_REQUEST,
            code = exception.code,
            message = exception.message ?: "Invalid ingest payload.",
        )
    }

    @ExceptionHandler(BatchSizeLimitExceededException::class)
    public fun handleBatchLimitException(
        exception: BatchSizeLimitExceededException,
        exchange: ServerWebExchange,
    ): ResponseEntity<IngestionErrorResponse> {
        ingestionMetrics.incrementValidationRejected()
        return error(
            exchange = exchange,
            status = HttpStatus.PAYLOAD_TOO_LARGE,
            code = exception.code,
            message = exception.message ?: "Batch size limit exceeded.",
        )
    }

    @ExceptionHandler(ApiKeyRejectedException::class)
    public fun handleApiKeyException(
        exception: ApiKeyRejectedException,
        exchange: ServerWebExchange,
    ): ResponseEntity<IngestionErrorResponse> {
        return error(
            exchange = exchange,
            status = HttpStatus.UNAUTHORIZED,
            code = exception.code,
            message = exception.message ?: "Invalid API key.",
        )
    }

    @ExceptionHandler(AdmissionRejectedException::class)
    public fun handleAdmissionException(
        exception: AdmissionRejectedException,
        exchange: ServerWebExchange,
    ): ResponseEntity<IngestionErrorResponse> {
        return error(
            exchange = exchange,
            status = HttpStatus.TOO_MANY_REQUESTS,
            code = exception.code,
            message = exception.message ?: "Admission limit reached.",
        )
    }

    @ExceptionHandler(ProducerUnavailableException::class)
    public fun handleProducerUnavailableException(
        exception: ProducerUnavailableException,
        exchange: ServerWebExchange,
    ): ResponseEntity<IngestionErrorResponse> {
        return error(
            exchange = exchange,
            status = HttpStatus.SERVICE_UNAVAILABLE,
            code = exception.code,
            message = exception.message ?: "Kafka unavailable.",
        )
    }

    @ExceptionHandler(ServerWebInputException::class)
    public fun handleBodyBindingException(
        exception: ServerWebInputException,
        exchange: ServerWebExchange,
    ): ResponseEntity<IngestionErrorResponse> {
        ingestionMetrics.incrementValidationRejected()
        return error(
            exchange = exchange,
            status = HttpStatus.BAD_REQUEST,
            code = "INGEST_BODY_BINDING_FAILED",
            message = exception.reason ?: "Malformed request body.",
        )
    }

    @ExceptionHandler(Throwable::class)
    public fun handleUnexpectedException(
        exception: Throwable,
        exchange: ServerWebExchange,
    ): ResponseEntity<IngestionErrorResponse> {
        return error(
            exchange = exchange,
            status = HttpStatus.INTERNAL_SERVER_ERROR,
            code = "INGEST_UNEXPECTED_ERROR",
            message = "Unexpected ingestion error.",
        )
    }

    private fun error(
        exchange: ServerWebExchange,
        status: HttpStatus,
        code: String,
        message: String,
    ): ResponseEntity<IngestionErrorResponse> {
        val payload = IngestionErrorResponse(
            timestamp = Instant.now().toString(),
            status = status.value(),
            error = status.reasonPhrase,
            code = code,
            message = message,
            path = exchange.request.path.value(),
        )
        return ResponseEntity.status(status).body(payload)
    }
}
