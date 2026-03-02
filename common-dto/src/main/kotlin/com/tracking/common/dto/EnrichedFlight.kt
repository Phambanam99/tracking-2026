package com.tracking.common.dto

import com.fasterxml.jackson.annotation.JsonAlias
import com.fasterxml.jackson.annotation.JsonProperty
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
public data class EnrichedFlight(
    val icao: String,
    val lat: Double,
    val lon: Double,
    val altitude: Int? = null,
    val speed: Double? = null,
    val heading: Double? = null,
    @param:JsonProperty("event_time")
    @get:JsonProperty("event_time")
    @param:JsonAlias("eventTime")
    @SerialName("event_time")
    val eventTime: Long,
    @param:JsonProperty("source_id")
    @get:JsonProperty("source_id")
    @param:JsonAlias("sourceId")
    @SerialName("source_id")
    val sourceId: String,
    @param:JsonProperty("is_historical")
    @get:JsonProperty("is_historical")
    @param:JsonAlias("isHistorical")
    @SerialName("is_historical")
    val isHistorical: Boolean = false,
    val metadata: AircraftMetadata? = null,
)
