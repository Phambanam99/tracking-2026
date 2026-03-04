package com.tracking.query.dto

public data class ShipHistoryPositionDto(
    val mmsi: String,
    val lat: Double,
    val lon: Double,
    val speed: Double? = null,
    val course: Double? = null,
    val heading: Double? = null,
    val navStatus: String? = null,
    val eventTime: Long,
    val sourceId: String? = null,
    val upstreamSource: String? = null,
)
