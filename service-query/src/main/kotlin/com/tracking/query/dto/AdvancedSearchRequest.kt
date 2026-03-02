package com.tracking.query.dto

import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size

/**
 * Multi-criteria search request for historical flight data.
 *
 * At least one filter must be specified.
 */
public data class AdvancedSearchRequest(
    @field:Size(max = 6)
    @field:Pattern(regexp = "^[0-9A-Fa-f]{1,6}$", message = "ICAO must be hex characters")
    val icao: String? = null,

    @field:Size(max = 20)
    val callsign: String? = null,

    @field:Size(max = 20)
    val aircraftType: String? = null,

    /** Epoch millis (inclusive) */
    val timeFrom: Long? = null,

    /** Epoch millis (inclusive) */
    val timeTo: Long? = null,

    /** Minimum altitude in feet */
    val altitudeMin: Int? = null,

    /** Maximum altitude in feet */
    val altitudeMax: Int? = null,

    /** Minimum speed in knots */
    val speedMin: Double? = null,

    /** Maximum speed in knots */
    val speedMax: Double? = null,

    val boundingBox: BoundingBoxDto? = null,

    val sourceId: String? = null,

    @field:Max(5000)
    val limit: Int = 100,
) {
    init {
        require(
            icao != null || callsign != null || aircraftType != null ||
                timeFrom != null || boundingBox != null || sourceId != null,
        ) { "At least one search filter must be specified" }
    }
}

/**
 * Simple rectangular bounding box.
 *
 * **Known limitation:** Does not handle antimeridian crossing.
 */
public data class BoundingBoxDto(
    val north: Double,
    val south: Double,
    val east: Double,
    val west: Double,
) {
    init {
        require(north > south) { "north must be greater than south" }
        require(east != west) { "east and west must differ" }
    }
}
