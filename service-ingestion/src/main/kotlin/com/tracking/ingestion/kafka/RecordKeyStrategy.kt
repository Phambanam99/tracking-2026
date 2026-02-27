package com.tracking.ingestion.kafka

import com.tracking.common.dto.CanonicalFlight
import org.springframework.stereotype.Component

@Component
public class RecordKeyStrategy {
    public fun keyFor(flight: CanonicalFlight): String = flight.icao
}
