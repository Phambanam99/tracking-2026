package com.tracking.processing.validation

import com.tracking.common.dto.CanonicalFlight
import io.kotest.matchers.doubles.shouldBeLessThan
import io.kotest.matchers.shouldBe
import kotlin.test.Test

public class KinematicValidatorTest {
    private val validator: KinematicValidator = KinematicValidator(maxSpeedKmh = 1200.0)

    @Test
    public fun `should accept plausible movement`() {
        val previous =
            CanonicalFlight(
                icao = "AAA111",
                lat = 21.0285,
                lon = 105.8542,
                eventTime = 1_700_000_000_000,
                sourceId = "crawler-1",
            )
        val current =
            CanonicalFlight(
                icao = "AAA111",
                lat = 21.08,
                lon = 105.90,
                eventTime = 1_700_000_120_000,
                sourceId = "crawler-1",
            )

        val result = validator.validate(previous, current)

        result.isValid shouldBe true
        result.computedSpeedKmh shouldBeLessThan 1200.0
    }

    @Test
    public fun `should reject impossible movement`() {
        val previous =
            CanonicalFlight(
                icao = "AAA111",
                lat = 21.0285,
                lon = 105.8542,
                eventTime = 1_700_000_000_000,
                sourceId = "crawler-1",
            )
        val current =
            CanonicalFlight(
                icao = "AAA111",
                lat = 22.0285,
                lon = 106.8542,
                eventTime = 1_700_000_010_000,
                sourceId = "crawler-1",
            )

        val result = validator.validate(previous, current)

        result.isValid shouldBe false
    }

    @Test
    public fun `should reject movement when event time delta is zero`() {
        val previous =
            CanonicalFlight(
                icao = "AAA111",
                lat = 21.0285,
                lon = 105.8542,
                eventTime = 1_700_000_000_000,
                sourceId = "crawler-1",
            )
        val current =
            CanonicalFlight(
                icao = "AAA111",
                lat = 21.1285,
                lon = 105.9542,
                eventTime = 1_700_000_000_000,
                sourceId = "crawler-1",
            )

        val result = validator.validate(previous, current)

        result.isValid shouldBe false
        result.computedSpeedKmh shouldBe Double.POSITIVE_INFINITY
    }
}
