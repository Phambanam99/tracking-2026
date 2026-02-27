package com.tracking.ingestion.tracing

import org.springframework.http.server.reactive.ServerHttpRequest
import org.springframework.stereotype.Component

public data class TraceContext(
    val requestId: String?,
    val traceparent: String?,
)

@Component
public class TraceContextExtractor {
    public fun extract(request: ServerHttpRequest): TraceContext {
        val requestId = request.headers.getFirst(HEADER_REQUEST_ID)?.trim().orEmpty().ifBlank { null }
        val traceparent = request.headers.getFirst(HEADER_TRACEPARENT)?.trim().orEmpty().ifBlank { null }
        return TraceContext(
            requestId = requestId,
            traceparent = traceparent,
        )
    }

    public companion object {
        public const val HEADER_REQUEST_ID: String = "x-request-id"
        public const val HEADER_TRACEPARENT: String = "traceparent"
    }
}
