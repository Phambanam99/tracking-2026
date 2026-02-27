package com.tracking.processing.dedup

import com.tracking.common.dto.CanonicalFlight

public class DedupKeyService {
    public fun keyFor(flight: CanonicalFlight): String {
        return "${flight.icao}_${flight.lat}_${flight.lon}_${flight.eventTime}"
    }
}
