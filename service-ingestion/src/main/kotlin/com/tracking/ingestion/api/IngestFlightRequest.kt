package com.tracking.ingestion.api

import com.fasterxml.jackson.annotation.JsonAlias
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty

@JsonIgnoreProperties(ignoreUnknown = true)
public data class IngestFlightRequest(
    @JsonProperty("icao")
    val icao: String? = null,
    @JsonProperty("lat")
    val lat: Double? = null,
    @JsonProperty("lon")
    val lon: Double? = null,
    @JsonProperty("altitude")
    val altitude: Int? = null,
    @JsonProperty("speed")
    val speed: Double? = null,
    @JsonProperty("heading")
    val heading: Double? = null,
    @JsonProperty("aircraft_type")
    @JsonAlias("aircraftType")
    val aircraftType: String? = null,
    @JsonProperty("event_time")
    @JsonAlias("eventTime", "timestamp")
    val eventTime: Long? = null,
    @JsonProperty("source_id")
    @JsonAlias("sourceId")
    val sourceId: String? = null,
)
