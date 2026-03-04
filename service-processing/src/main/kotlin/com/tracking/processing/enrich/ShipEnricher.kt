package com.tracking.processing.enrich

import com.tracking.common.dto.CanonicalShip
import com.tracking.common.dto.EnrichedShip
import com.tracking.common.dto.ShipMetadata

public class ShipEnricher(
        private val midCountryResolver: MidCountryResolver = MidCountryResolver(),
) {
    public fun enrich(ship: CanonicalShip, isHistorical: Boolean): EnrichedShip {
        return EnrichedShip(
                mmsi = ship.mmsi,
                lat = ship.lat,
                lon = ship.lon,
                speed = ship.speed,
                course = ship.course,
                heading = ship.heading,
                navStatus = ship.navStatus,
                vesselName = ship.vesselName,
                vesselType = ship.vesselType,
                imo = ship.imo,
                callSign = ship.callSign,
                destination = ship.destination,
                eta = ship.eta,
                eventTime = ship.eventTime,
                sourceId = ship.sourceId,
                upstreamSource = ship.upstreamSource,
                isHistorical = isHistorical,
                score = ship.score,
                metadata = buildMetadata(ship),
        )
    }

    private fun buildMetadata(ship: CanonicalShip): ShipMetadata {
        val countryInfo = midCountryResolver.resolve(ship.mmsi)
        val shipTypeName =
                ship.vesselType?.replaceFirstChar { value: Char ->
                    if (value.isLowerCase()) {
                        value.titlecase()
                    } else {
                        value.toString()
                    }
                }

        return ShipMetadata(
                flagCountry = countryInfo?.countryName,
                flagUrl = countryInfo?.flagUrl,
                shipTypeName = shipTypeName,
                isMilitary = false,
        )
    }
}
