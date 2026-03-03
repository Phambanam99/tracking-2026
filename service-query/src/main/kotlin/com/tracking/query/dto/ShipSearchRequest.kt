package com.tracking.query.dto

import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size

public data class ShipSearchRequest(
    @field:Size(max = 32)
    @field:Pattern(regexp = "^[0-9]{1,32}$", message = "MMSI must be numeric")
    val mmsi: String? = null,

    @field:Size(max = 32)
    val imo: String? = null,

    @field:Size(max = 64)
    val callSign: String? = null,

    @field:Size(max = 256)
    val vesselName: String? = null,

    @field:Size(max = 128)
    val vesselType: String? = null,

    @field:Size(max = 256)
    val destination: String? = null,

    val timeFrom: Long? = null,

    val timeTo: Long? = null,

    val speedMin: Double? = null,

    val speedMax: Double? = null,

    val boundingBox: BoundingBoxDto? = null,

    val sourceId: String? = null,

    @field:Max(5000)
    val limit: Int = 100,
) {
    init {
        require(
            mmsi != null || imo != null || callSign != null || vesselName != null ||
                vesselType != null || destination != null || timeFrom != null ||
                boundingBox != null || sourceId != null,
        ) { "At least one search filter must be specified" }
    }
}
