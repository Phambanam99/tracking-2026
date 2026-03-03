package com.tracking.processing.validation

import com.tracking.common.dto.CanonicalShip
import io.kotest.matchers.doubles.shouldBeLessThan
import io.kotest.matchers.shouldBe
import kotlin.test.Test

public class ShipKinematicValidatorTest {
    private val validator: ShipKinematicValidator = ShipKinematicValidator(maxSpeedKmh = 120.0)

    @Test
    public fun `should accept plausible ship movement`() {
        val previous =
            CanonicalShip(
                mmsi = "574001230",
                lat = 10.7769,
                lon = 106.7009,
                eventTime = 1_700_000_000_000,
                sourceId = "ais-1",
            )
        val current =
            CanonicalShip(
                mmsi = "574001230",
                lat = 10.78,
                lon = 106.71,
                eventTime = 1_700_000_600_000,
                sourceId = "ais-1",
            )

        val result = validator.validate(previous, current)

        result.isValid shouldBe true
        result.computedSpeedKmh shouldBeLessThan 120.0
    }

    @Test
    public fun `should reject impossible ship movement`() {
        val previous =
            CanonicalShip(
                mmsi = "574001230",
                lat = 10.7769,
                lon = 106.7009,
                eventTime = 1_700_000_000_000,
                sourceId = "ais-1",
            )
        val current =
            CanonicalShip(
                mmsi = "574001230",
                lat = 12.7769,
                lon = 108.7009,
                eventTime = 1_700_000_010_000,
                sourceId = "ais-1",
            )

        val result = validator.validate(previous, current)

        result.isValid shouldBe false
    }
}
