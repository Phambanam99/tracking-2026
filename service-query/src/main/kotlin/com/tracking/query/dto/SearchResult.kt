package com.tracking.query.dto

/**
 * Unified search result returned by both live (Redis) and historical (DB) search.
 */
public data class SearchResult(
    val icao: String,
    val lat: Double,
    val lon: Double,
    val altitude: Int? = null,
    val speed: Double? = null,
    val heading: Double? = null,
    val eventTime: Long,
    val sourceId: String? = null,
    val registration: String? = null,
    val aircraftType: String? = null,
    val operator: String? = null,
    val isMilitary: Boolean = false,
)
