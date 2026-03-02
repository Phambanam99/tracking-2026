package com.tracking.processing.enrich

import com.tracking.common.dto.AircraftMetadata
import com.tracking.common.dto.CanonicalFlight
import com.tracking.common.dto.EnrichedFlight

public class FlightEnricher(
    private val referenceDataCache: ReferenceDataCache,
    private val icaoCountryResolver: IcaoCountryResolver,
    private val aircraftPhotoProvider: AircraftPhotoProvider = NoopAircraftPhotoProvider,
    private val icaoRegistrationResolver: IcaoRegistrationResolver = IcaoRegistrationResolver(),
) {
    public fun enrich(flight: CanonicalFlight, isHistorical: Boolean): EnrichedFlight {
        val cachedMetadata = referenceDataCache.findByIcao(flight.icao)
        val resolvedCountry = icaoCountryResolver.resolve(flight.icao)
        val metadata =
            AircraftMetadata(
                registration = cachedMetadata?.registration
                    ?: icaoRegistrationResolver.resolve(flight.icao),
                aircraftType = cachedMetadata?.aircraftType,
                operator = cachedMetadata?.operator,
                countryCode = cachedMetadata?.countryCode ?: resolvedCountry?.countryCode,
                countryFlagUrl = cachedMetadata?.countryFlagUrl ?: resolvedCountry?.countryFlagUrl,
                imageUrl =
                    cachedMetadata?.imageUrl
                        ?: aircraftPhotoProvider.photoUrlFor(flight.icao)
                        ?: icaoCountryResolver.imageUrlFor(flight.icao),
            )
        val normalizedMetadata =
            if (
                metadata.registration == null &&
                metadata.aircraftType == null &&
                metadata.operator == null &&
                metadata.countryCode == null &&
                metadata.countryFlagUrl == null &&
                metadata.imageUrl == null
            ) {
                null
            } else {
                metadata
            }

        return EnrichedFlight(
            icao = flight.icao,
            lat = flight.lat,
            lon = flight.lon,
            altitude = flight.altitude,
            speed = flight.speed,
            heading = flight.heading,
            eventTime = flight.eventTime,
            sourceId = flight.sourceId,
            isHistorical = isHistorical,
            metadata = normalizedMetadata,
        )
    }
}
