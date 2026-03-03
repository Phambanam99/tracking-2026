package com.tracking.ingestion.kafka

import com.tracking.common.dto.CanonicalShip
import org.springframework.stereotype.Component

@Component
public class MmsiRecordKeyStrategy {
    public fun keyFor(ship: CanonicalShip): String = ship.mmsi
}
