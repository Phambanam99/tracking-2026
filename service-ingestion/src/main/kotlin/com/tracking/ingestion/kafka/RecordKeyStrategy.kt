package com.tracking.ingestion.kafka

import com.tracking.common.dto.CanonicalFlight

public class RecordKeyStrategy {
    public fun keyFor(flight: CanonicalFlight): String = flight.icao
}
