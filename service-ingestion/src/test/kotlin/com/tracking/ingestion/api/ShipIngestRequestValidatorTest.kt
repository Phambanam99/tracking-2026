package com.tracking.ingestion.api

import com.tracking.ingestion.config.IngestionProperties
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

public class ShipIngestRequestValidatorTest {
    private val validator = ShipIngestRequestValidator(IngestionProperties())

    @Test
    public fun `should map ship request into canonical ship`() {
        val ship =
            validator.validateSingle(
                request =
                    IngestShipRequest(
                        mmsi = "574001230",
                        lat = 10.7769,
                        lon = 106.7009,
                        course = 182.5,
                        callSign = " 3WAB2 ",
                        eventTime = 1_708_941_600_000,
                        sourceId = "AIS-PRIMARY",
                    ),
                sourceIdHeader = null,
            )

        assertEquals("574001230", ship.mmsi)
        assertEquals(182.5, ship.course)
        assertEquals("3WAB2", ship.callSign)
    }

    @Test
    public fun `should prefer source header over request source id`() {
        val ship =
            validator.validateSingle(
                request =
                    IngestShipRequest(
                        mmsi = "574001230",
                        lat = 10.7769,
                        lon = 106.7009,
                        eventTime = 1_708_941_600_000,
                        sourceId = "AIS-REQUEST",
                    ),
                sourceIdHeader = "AIS-HEADER",
            )

        assertEquals("AIS-HEADER", ship.sourceId)
    }

    @Test
    public fun `should reject invalid mmsi`() {
        assertFailsWith<IngestValidationException> {
            validator.validateSingle(
                request =
                    IngestShipRequest(
                        mmsi = "57A00123",
                        lat = 10.7769,
                        lon = 106.7009,
                        eventTime = 1_708_941_600_000,
                        sourceId = "AIS-PRIMARY",
                    ),
                sourceIdHeader = null,
            )
        }
    }
}
