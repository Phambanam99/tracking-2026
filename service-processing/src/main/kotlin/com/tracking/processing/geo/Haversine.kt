package com.tracking.processing.geo

import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

public object Haversine {
    private const val EARTH_RADIUS_KM: Double = 6371.0

    public fun distanceKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)

        val originLat = Math.toRadians(lat1)
        val destinationLat = Math.toRadians(lat2)

        val haversine =
            sin(dLat / 2).pow(2) +
                cos(originLat) * cos(destinationLat) * sin(dLon / 2).pow(2)

        return 2 * EARTH_RADIUS_KM * asin(sqrt(haversine))
    }
}
