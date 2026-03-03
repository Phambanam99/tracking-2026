package com.tracking.processing.dedup

import com.tracking.common.dto.CanonicalShip

public class ShipDedupKeyService {
    public fun keyFor(ship: CanonicalShip): String {
        return "${ship.mmsi}_${ship.lat}_${ship.lon}_${ship.eventTime}"
    }
}
