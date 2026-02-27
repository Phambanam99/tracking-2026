package com.tracking.common.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
public data class LiveFlightMessage(
    @SerialName("sent_at")
    val sentAt: Long,
    val flight: EnrichedFlight,
)
