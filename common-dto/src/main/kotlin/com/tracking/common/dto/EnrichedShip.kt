package com.tracking.common.dto

import com.fasterxml.jackson.annotation.JsonAlias
import com.fasterxml.jackson.annotation.JsonProperty
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
public data class EnrichedShip(
    val mmsi: String,
    val lat: Double,
    val lon: Double,
    val speed: Double? = null,
    val course: Double? = null,
    val heading: Double? = null,
    @param:JsonProperty("nav_status")
    @get:JsonProperty("nav_status")
    @param:JsonAlias("navStatus")
    @SerialName("nav_status")
    val navStatus: String? = null,
    @param:JsonProperty("vessel_name")
    @get:JsonProperty("vessel_name")
    @param:JsonAlias("vesselName")
    @SerialName("vessel_name")
    val vesselName: String? = null,
    @param:JsonProperty("vessel_type")
    @get:JsonProperty("vessel_type")
    @param:JsonAlias("vesselType")
    @SerialName("vessel_type")
    val vesselType: String? = null,
    val imo: String? = null,
    @param:JsonProperty("call_sign")
    @get:JsonProperty("call_sign")
    @param:JsonAlias("callSign")
    @SerialName("call_sign")
    val callSign: String? = null,
    val destination: String? = null,
    val eta: Long? = null,
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
    @param:JsonProperty("upstream_source")
    @get:JsonProperty("upstream_source")
    @param:JsonAlias("upstreamSource")
    @SerialName("upstream_source")
    val upstreamSource: String? = null,
    @param:JsonProperty("is_historical")
    @get:JsonProperty("is_historical")
    @param:JsonAlias("isHistorical")
    @SerialName("is_historical")
    val isHistorical: Boolean = false,
    val score: Double? = null,
    val metadata: ShipMetadata? = null,
)
