package com.tracking.storage.model

import com.tracking.common.dto.EnrichedShip
import com.tracking.storage.tracing.StorageTraceContext

public data class PersistableShip(
    val ship: EnrichedShip,
    val sourceTopic: String,
    val rawPayload: String,
    val traceContext: StorageTraceContext = StorageTraceContext(),
)
