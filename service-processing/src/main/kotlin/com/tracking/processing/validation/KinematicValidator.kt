package com.tracking.processing.validation

import com.tracking.common.dto.CanonicalFlight
import com.tracking.processing.geo.Haversine

public class KinematicValidator(
    private val maxSpeedKmh: Double = 1200.0,
) {
    public fun validate(previous: CanonicalFlight, current: CanonicalFlight): KinematicValidationResult {
        val deltaMillis = current.eventTime - previous.eventTime
        if (deltaMillis <= 0) {
            return KinematicValidationResult(
                isValid = false,
                computedSpeedKmh = Double.POSITIVE_INFINITY,
            )
        }

        val distanceKm = Haversine.distanceKm(previous.lat, previous.lon, current.lat, current.lon)
        val hours = deltaMillis / 3_600_000.0
        val speedKmh = distanceKm / hours

        return KinematicValidationResult(
            isValid = speedKmh <= maxSpeedKmh,
            computedSpeedKmh = speedKmh,
        )
    }
}

public data class KinematicValidationResult(
    val isValid: Boolean,
    val computedSpeedKmh: Double,
)
