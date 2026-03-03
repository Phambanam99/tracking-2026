package com.tracking.ingestion.api

import com.tracking.common.dto.CanonicalShip
import com.tracking.ingestion.config.IngestionProperties
import org.springframework.stereotype.Component

@Component
public class ShipIngestRequestValidator(
    private val ingestionProperties: IngestionProperties,
) {
    public fun validateSingle(request: IngestShipRequest, sourceIdHeader: String?): CanonicalShip {
        val sourceId = sourceIdHeader.normalizeOrNull() ?: request.sourceId.normalizeOrNull()
            ?: throw IngestValidationException("source_id is required.")
        val mmsi = request.mmsi.normalizeMmsiOrNull()
            ?: throw IngestValidationException("mmsi must be a 9-digit numeric string.")

        val lat = request.lat ?: throw IngestValidationException("lat is required.")
        if (!lat.isFinite() || lat !in LAT_RANGE) {
            throw IngestValidationException("lat must be within [-90, 90].")
        }

        val lon = request.lon ?: throw IngestValidationException("lon is required.")
        if (!lon.isFinite() || lon !in LON_RANGE) {
            throw IngestValidationException("lon must be within [-180, 180].")
        }

        val eventTime = request.eventTime ?: throw IngestValidationException("event_time is required.")
        if (eventTime <= 0) {
            throw IngestValidationException("event_time must be positive.")
        }

        return CanonicalShip(
            mmsi = mmsi,
            lat = lat,
            lon = lon,
            speed = request.speed.finiteOrNull("speed"),
            course = request.course.finiteOrNull("course"),
            heading = request.heading.finiteOrNull("heading"),
            navStatus = request.navStatus.normalizeOrNull(),
            vesselName = request.vesselName.normalizeOrNull(),
            vesselType = request.vesselType.normalizeOrNull(),
            imo = request.imo.normalizeOrNull(),
            callSign = request.callSign.normalizeOrNull(),
            destination = request.destination.normalizeOrNull(),
            eta = request.eta?.takeIf { it > 0 },
            eventTime = eventTime,
            sourceId = sourceId,
            score = request.score.finiteOrNull("score"),
        )
    }

    public fun validateBatch(request: IngestShipBatchRequest, sourceIdHeader: String?): List<CanonicalShip> {
        if (request.records.isEmpty()) {
            throw IngestValidationException("records must not be empty.")
        }

        if (request.records.size > ingestionProperties.batch.maxRecords) {
            throw BatchSizeLimitExceededException(
                "Batch size ${request.records.size} exceeds limit ${ingestionProperties.batch.maxRecords}.",
            )
        }

        return request.records.mapIndexed { index, record ->
            try {
                validateSingle(record, sourceIdHeader)
            } catch (exception: IngestValidationException) {
                throw IngestValidationException("records[$index]: ${exception.message}")
            }
        }
    }

    private fun String?.normalizeOrNull(): String? {
        val normalized = this?.trim().orEmpty()
        return normalized.takeIf { it.isNotEmpty() }
    }

    private fun String?.normalizeMmsiOrNull(): String? {
        val normalized = normalizeOrNull() ?: return null
        return normalized.takeIf { value -> value.length == MMSI_LENGTH && value.all(Char::isDigit) }
    }

    private fun Double?.finiteOrNull(fieldName: String): Double? {
        if (this == null) {
            return null
        }
        if (!isFinite()) {
            throw IngestValidationException("$fieldName must be finite.")
        }
        return this
    }

    private companion object {
        private const val MMSI_LENGTH: Int = 9
        private val LAT_RANGE: ClosedFloatingPointRange<Double> = -90.0..90.0
        private val LON_RANGE: ClosedFloatingPointRange<Double> = -180.0..180.0
    }
}
