package com.tracking.common.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
public data class CanonicalFlight(
    val icao: String,
    val lat: Double,
    val lon: Double,
    val altitude: Int? = null,
    val speed: Double? = null,
    val heading: Double? = null,
    @SerialName("event_time")
    val eventTime: Long,
    @SerialName("source_id")
    val sourceId: String,
)
