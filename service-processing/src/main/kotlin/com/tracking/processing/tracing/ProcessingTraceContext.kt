package com.tracking.processing.tracing

import java.nio.charset.StandardCharsets
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.apache.kafka.common.header.Headers
import org.apache.kafka.common.header.internals.RecordHeader
import org.slf4j.MDC

public data class ProcessingTraceContext(
    val requestId: String? = null,
    val traceparent: String? = null,
)

public object ProcessingTraceHeaders {
    public const val REQUEST_ID: String = "x-request-id"
    public const val TRACEPARENT: String = "traceparent"
}

public object KafkaTraceContextExtractor {
    public fun extract(record: ConsumerRecord<*, *>): ProcessingTraceContext = extract(record.headers())

    public fun extract(headers: Headers): ProcessingTraceContext {
        return ProcessingTraceContext(
            requestId = readUtf8(headers, ProcessingTraceHeaders.REQUEST_ID),
            traceparent = readUtf8(headers, ProcessingTraceHeaders.TRACEPARENT),
        )
    }

    private fun readUtf8(headers: Headers, key: String): String? {
        val header = headers.lastHeader(key) ?: return null
        return String(header.value(), StandardCharsets.UTF_8).takeIf { it.isNotBlank() }
    }
}

public object KafkaTraceContextPropagator {
    public fun addTo(headers: Headers, context: ProcessingTraceContext?): Unit {
        if (context == null) {
            return
        }

        addUtf8(headers, ProcessingTraceHeaders.REQUEST_ID, context.requestId)
        addUtf8(headers, ProcessingTraceHeaders.TRACEPARENT, context.traceparent)
    }

    private fun addUtf8(headers: Headers, key: String, value: String?): Unit {
        val normalized = value?.trim().orEmpty()
        if (normalized.isEmpty()) {
            return
        }

        headers.remove(key)
        headers.add(RecordHeader(key, normalized.toByteArray(StandardCharsets.UTF_8)))
    }
}

public object TraceContextHolder {
    private val contextHolder: ThreadLocal<ProcessingTraceContext?> = ThreadLocal()

    public fun current(): ProcessingTraceContext? = contextHolder.get()

    public fun <T> withContext(context: ProcessingTraceContext?, block: () -> T): T {
        val previousContext = contextHolder.get()
        val previousRequestId = MDC.get(ProcessingTraceHeaders.REQUEST_ID)
        val previousTraceparent = MDC.get(ProcessingTraceHeaders.TRACEPARENT)

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

    private fun applyMdc(context: ProcessingTraceContext?): Unit {
        if (context?.requestId.isNullOrBlank()) {
            MDC.remove(ProcessingTraceHeaders.REQUEST_ID)
        } else {
            MDC.put(ProcessingTraceHeaders.REQUEST_ID, context?.requestId)
        }

        if (context?.traceparent.isNullOrBlank()) {
            MDC.remove(ProcessingTraceHeaders.TRACEPARENT)
        } else {
            MDC.put(ProcessingTraceHeaders.TRACEPARENT, context?.traceparent)
        }
    }

    private fun restoreMdc(previousRequestId: String?, previousTraceparent: String?): Unit {
        if (previousRequestId == null) {
            MDC.remove(ProcessingTraceHeaders.REQUEST_ID)
        } else {
            MDC.put(ProcessingTraceHeaders.REQUEST_ID, previousRequestId)
        }

        if (previousTraceparent == null) {
            MDC.remove(ProcessingTraceHeaders.TRACEPARENT)
        } else {
            MDC.put(ProcessingTraceHeaders.TRACEPARENT, previousTraceparent)
        }
    }
}
