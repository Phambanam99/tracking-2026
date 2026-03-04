package com.tracking.ingestion.api

import com.fasterxml.jackson.annotation.JsonAlias
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty

@JsonIgnoreProperties(ignoreUnknown = true)
public data class IngestShipRequest(
    @JsonProperty("mmsi")
    val mmsi: String? = null,
    @JsonProperty("lat")
    val lat: Double? = null,
    @JsonProperty("lon")
    val lon: Double? = null,
    @JsonProperty("speed")
    val speed: Double? = null,
    @JsonProperty("course")
    val course: Double? = null,
    @JsonProperty("heading")
    val heading: Double? = null,
    @JsonProperty("nav_status")
    @JsonAlias("navStatus")
    val navStatus: String? = null,
    @JsonProperty("vessel_name")
    @JsonAlias("vesselName")
    val vesselName: String? = null,
    @JsonProperty("vessel_type")
    @JsonAlias("vesselType")
    val vesselType: String? = null,
    @JsonProperty("imo")
    val imo: String? = null,
    @JsonProperty("call_sign")
    @JsonAlias("callSign")
    val callSign: String? = null,
    @JsonProperty("destination")
    val destination: String? = null,
    @JsonProperty("eta")
    val eta: Long? = null,
    @JsonProperty("event_time")
    @JsonAlias("eventTime", "timestamp")
    val eventTime: Long? = null,
    @JsonProperty("source_id")
    @JsonAlias("sourceId")
    val sourceId: String? = null,
    @JsonProperty("upstream_source")
    @JsonAlias("upstreamSource")
    val upstreamSource: String? = null,
    @JsonProperty("score")
    val score: Double? = null,
)
