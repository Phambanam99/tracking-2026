package com.tracking.processing.state

import com.tracking.common.dto.CanonicalFlight
import java.util.concurrent.ConcurrentHashMap

public class LastKnownStateStore {
    private val states: MutableMap<String, CanonicalFlight> = ConcurrentHashMap()

    public fun get(icao: String): CanonicalFlight? = states[icao]

    public fun put(flight: CanonicalFlight): Unit {
        states[flight.icao] = flight
    }
}
