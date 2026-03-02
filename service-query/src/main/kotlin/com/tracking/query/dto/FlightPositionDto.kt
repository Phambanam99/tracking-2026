package com.tracking.query.dto

/**
 * Single position record in a flight trail (for history endpoint).
 */
public data class FlightPositionDto(
    val icao: String,
    val lat: Double,
    val lon: Double,
    val altitude: Int? = null,
    val speed: Double? = null,
    val heading: Double? = null,
    val eventTime: Long,
    val sourceId: String? = null,
)
