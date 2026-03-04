package com.tracking.query.dto

public data class ShipSearchResult(
        val mmsi: String,
        val lat: Double,
        val lon: Double,
        val speed: Double? = null,
        val course: Double? = null,
        val heading: Double? = null,
        val eventTime: Long,
        val sourceId: String? = null,
        val upstreamSource: String? = null,
        val vesselName: String? = null,
        val vesselType: String? = null,
        val imo: String? = null,
        val callSign: String? = null,
        val destination: String? = null,
        val navStatus: String? = null,
        val isMilitary: Boolean = false,
        val flagCountry: String? = null,
        val flagUrl: String? = null,
)
