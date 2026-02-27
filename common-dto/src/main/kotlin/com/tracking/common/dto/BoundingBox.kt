package com.tracking.common.dto

import kotlinx.serialization.Serializable

@Serializable
public data class BoundingBox(
    val north: Double,
    val south: Double,
    val east: Double,
    val west: Double,
) {
    public fun contains(lat: Double, lon: Double): Boolean {
        return lat in south..north && lon in west..east
    }
}
