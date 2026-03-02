package com.tracking.common.dto

import com.fasterxml.jackson.annotation.JsonAlias
import com.fasterxml.jackson.annotation.JsonProperty
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
    @param:JsonProperty("aircraft_type")
    @get:JsonProperty("aircraft_type")
    @param:JsonAlias("aircraftType")
    @SerialName("aircraft_type")
    val aircraftType: String? = null,
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
)
