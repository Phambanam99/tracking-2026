package com.tracking.processing.enrich

import com.tracking.common.dto.AircraftMetadata

public fun interface ReferenceDataLoader {
    public fun load(): Map<String, AircraftMetadata>
}
