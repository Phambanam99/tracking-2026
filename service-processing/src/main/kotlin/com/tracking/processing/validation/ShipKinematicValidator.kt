package com.tracking.processing.validation

import com.tracking.common.dto.CanonicalShip
import com.tracking.processing.geo.Haversine

public class ShipKinematicValidator(
    private val maxSpeedKmh: Double = 120.0,
) {
    public fun validate(previous: CanonicalShip, current: CanonicalShip): KinematicValidationResult {
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
