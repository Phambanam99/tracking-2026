package com.tracking.storage.model

import com.tracking.common.dto.EnrichedFlight
import com.tracking.storage.tracing.StorageTraceContext
import java.time.Instant

public data class PersistableFlight(
    val flight: EnrichedFlight,
    val sourceTopic: String,
    val rawPayload: String,
    val traceContext: StorageTraceContext = StorageTraceContext(),
)

public data class StorageFailedRecord(
    val reason: String,
    val sourceTopic: String,
    val payload: String,
    val icao: String? = null,
    val recordKey: String? = icao,
    val traceContext: StorageTraceContext = StorageTraceContext(),
    val errorMessage: String? = null,
    val occurredAt: Instant = Instant.now(),
)
