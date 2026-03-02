package com.tracking.ingestion.api

import com.tracking.ingestion.config.IngestionProperties
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

public class IngestRequestValidatorTest {
    private val validator = IngestRequestValidator(IngestionProperties())

    @Test
    public fun `should map aircraft type from request into canonical flight`() {
        val flight =
            validator.validateSingle(
                request =
                    IngestFlightRequest(
                        icao = "004014",
                        lat = 21.0,
                        lon = 105.0,
                        aircraftType = "b772",
                        eventTime = 1_708_941_600_000,
                        sourceId = "RADARBOX-GLOBAL",
                    ),
                sourceIdHeader = null,
            )

        assertEquals("B772", flight.aircraftType)
    }

    @Test
    public fun `should treat blank aircraft type as null`() {
        val flight =
            validator.validateSingle(
                request =
                    IngestFlightRequest(
                        icao = "004014",
                        lat = 21.0,
                        lon = 105.0,
                        aircraftType = "   ",
                        eventTime = 1_708_941_600_000,
                        sourceId = "RADARBOX-GLOBAL",
                    ),
                sourceIdHeader = null,
            )

        assertNull(flight.aircraftType)
    }
}
