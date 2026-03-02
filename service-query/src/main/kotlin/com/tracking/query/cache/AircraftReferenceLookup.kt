package com.tracking.query.cache

public data class AircraftReferenceMetadata(
    val registration: String? = null,
    val aircraftType: String? = null,
    val operator: String? = null,
)

public fun interface AircraftReferenceLookup {
    public fun findByIcao(icao: String): AircraftReferenceMetadata?
}

public object NoopAircraftReferenceLookup : AircraftReferenceLookup {
    override fun findByIcao(icao: String): AircraftReferenceMetadata? = null
}
