package com.tracking.storage.tracing

import java.nio.charset.StandardCharsets
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.apache.kafka.common.header.Headers
import org.slf4j.MDC

public data class StorageTraceContext(
    val requestId: String? = null,
    val traceparent: String? = null,
)

public object StorageTraceHeaders {
    public const val REQUEST_ID: String = "x-request-id"
    public const val TRACEPARENT: String = "traceparent"
}

public object StorageTraceContextExtractor {
    public fun extract(record: ConsumerRecord<*, *>): StorageTraceContext = extract(record.headers())

    public fun extract(headers: Headers): StorageTraceContext {
        return StorageTraceContext(
            requestId = readUtf8(headers, StorageTraceHeaders.REQUEST_ID),
            traceparent = readUtf8(headers, StorageTraceHeaders.TRACEPARENT),
        )
    }

    private fun readUtf8(headers: Headers, key: String): String? {
        val header = headers.lastHeader(key) ?: return null
        return String(header.value(), StandardCharsets.UTF_8).takeIf { it.isNotBlank() }
    }
}

public object StorageTraceContextHolder {
    private val contextHolder: ThreadLocal<StorageTraceContext?> = ThreadLocal()

    public fun current(): StorageTraceContext? = contextHolder.get()

    public fun <T> withContext(context: StorageTraceContext?, block: () -> T): T {
        val previousContext = contextHolder.get()
        val previousRequestId = MDC.get(StorageTraceHeaders.REQUEST_ID)
        val previousTraceparent = MDC.get(StorageTraceHeaders.TRACEPARENT)

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

    private fun applyMdc(context: StorageTraceContext?): Unit {
        if (context?.requestId.isNullOrBlank()) {
            MDC.remove(StorageTraceHeaders.REQUEST_ID)
        } else {
            MDC.put(StorageTraceHeaders.REQUEST_ID, context?.requestId)
        }

        if (context?.traceparent.isNullOrBlank()) {
            MDC.remove(StorageTraceHeaders.TRACEPARENT)
        } else {
            MDC.put(StorageTraceHeaders.TRACEPARENT, context?.traceparent)
        }
    }

    private fun restoreMdc(previousRequestId: String?, previousTraceparent: String?): Unit {
        if (previousRequestId == null) {
            MDC.remove(StorageTraceHeaders.REQUEST_ID)
        } else {
            MDC.put(StorageTraceHeaders.REQUEST_ID, previousRequestId)
        }

        if (previousTraceparent == null) {
            MDC.remove(StorageTraceHeaders.TRACEPARENT)
        } else {
            MDC.put(StorageTraceHeaders.TRACEPARENT, previousTraceparent)
        }
    }
}
