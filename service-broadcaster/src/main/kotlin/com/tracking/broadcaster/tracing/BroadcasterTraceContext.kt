package com.tracking.broadcaster.tracing

import java.nio.charset.StandardCharsets
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.apache.kafka.common.header.Headers
import org.slf4j.MDC

public data class BroadcasterTraceContext(
    val requestId: String? = null,
    val traceparent: String? = null,
)

public object BroadcasterTraceHeaders {
    public const val REQUEST_ID: String = "x-request-id"
    public const val TRACEPARENT: String = "traceparent"
}

public object BroadcasterTraceContextExtractor {
    public fun extract(record: ConsumerRecord<*, *>): BroadcasterTraceContext = extract(record.headers())

    public fun extract(headers: Headers): BroadcasterTraceContext =
        BroadcasterTraceContext(
            requestId = readUtf8(headers, BroadcasterTraceHeaders.REQUEST_ID),
            traceparent = readUtf8(headers, BroadcasterTraceHeaders.TRACEPARENT),
        )

    private fun readUtf8(headers: Headers, key: String): String? {
        val header = headers.lastHeader(key) ?: return null
        return String(header.value(), StandardCharsets.UTF_8).takeIf { it.isNotBlank() }
    }
}

public object BroadcasterTraceContextHolder {
    private val contextHolder: ThreadLocal<BroadcasterTraceContext?> = ThreadLocal()

    public fun current(): BroadcasterTraceContext? = contextHolder.get()

    public fun <T> withContext(context: BroadcasterTraceContext?, block: () -> T): T {
        val previousContext = contextHolder.get()
        val previousRequestId = MDC.get(BroadcasterTraceHeaders.REQUEST_ID)
        val previousTraceparent = MDC.get(BroadcasterTraceHeaders.TRACEPARENT)

        contextHolder.set(context)
        applyMdc(context)
        return try {
            block()
        } finally {
            restoreMdc(previousRequestId, previousTraceparent)
            if (previousContext == null) {
                contextHolder.remove()
            } else {
                contextHolder.set(previousContext)
            }
        }
    }

    private fun applyMdc(context: BroadcasterTraceContext?): Unit {
        if (context?.requestId.isNullOrBlank()) {
            MDC.remove(BroadcasterTraceHeaders.REQUEST_ID)
        } else {
            MDC.put(BroadcasterTraceHeaders.REQUEST_ID, context?.requestId)
        }

        if (context?.traceparent.isNullOrBlank()) {
            MDC.remove(BroadcasterTraceHeaders.TRACEPARENT)
        } else {
            MDC.put(BroadcasterTraceHeaders.TRACEPARENT, context?.traceparent)
        }
    }

    private fun restoreMdc(previousRequestId: String?, previousTraceparent: String?): Unit {
        if (previousRequestId == null) {
            MDC.remove(BroadcasterTraceHeaders.REQUEST_ID)
        } else {
            MDC.put(BroadcasterTraceHeaders.REQUEST_ID, previousRequestId)
        }

        if (previousTraceparent == null) {
            MDC.remove(BroadcasterTraceHeaders.TRACEPARENT)
        } else {
            MDC.put(BroadcasterTraceHeaders.TRACEPARENT, previousTraceparent)
        }
    }
}
