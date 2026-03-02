package com.tracking.common.dto

import com.fasterxml.jackson.annotation.JsonAlias
import com.fasterxml.jackson.annotation.JsonProperty
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
public data class LiveFlightMessage(
    @param:JsonProperty("sent_at")
    @get:JsonProperty("sent_at")
    @param:JsonAlias("sentAt")
    @SerialName("sent_at")
    val sentAt: Long,
    val flight: EnrichedFlight,
)
