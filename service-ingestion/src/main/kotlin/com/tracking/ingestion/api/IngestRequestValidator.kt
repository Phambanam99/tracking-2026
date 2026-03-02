package com.tracking.ingestion.api

import com.tracking.common.dto.CanonicalFlight
import com.tracking.ingestion.config.IngestionProperties
import org.springframework.stereotype.Component

@Component
public class IngestRequestValidator(
    private val ingestionProperties: IngestionProperties,
) {
    public fun validateSingle(request: IngestFlightRequest, sourceIdHeader: String?): CanonicalFlight {
        val sourceId = sourceIdHeader.normalizeOrNull() ?: request.sourceId.normalizeOrNull()
            ?: throw IngestValidationException("source_id is required.")

        val icao = request.icao.normalizeOrNull()
            ?: throw IngestValidationException("icao is required.")
        val aircraftType = request.aircraftType.normalizeAircraftTypeOrNull()

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

        val speed = request.speed
        if (speed != null && !speed.isFinite()) {
            throw IngestValidationException("speed must be finite.")
        }

        val heading = request.heading
        if (heading != null && !heading.isFinite()) {
            throw IngestValidationException("heading must be finite.")
        }

        return CanonicalFlight(
            icao = icao,
            lat = lat,
            lon = lon,
            altitude = request.altitude,
            speed = speed,
            heading = heading,
            aircraftType = aircraftType,
            eventTime = eventTime,
            sourceId = sourceId,
        )
    }

    public fun validateBatch(request: IngestBatchRequest, sourceIdHeader: String?): List<CanonicalFlight> {
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

    private fun String?.normalizeAircraftTypeOrNull(): String? = normalizeOrNull()?.uppercase()

    private companion object {
        private val LAT_RANGE: ClosedFloatingPointRange<Double> = -90.0..90.0
        private val LON_RANGE: ClosedFloatingPointRange<Double> = -180.0..180.0
    }
}
