package com.tracking.processing.state

import com.github.benmanes.caffeine.cache.Cache
import com.github.benmanes.caffeine.cache.Caffeine
import com.tracking.common.dto.CanonicalFlight
import java.time.Duration

public class LastKnownStateStore(
    private val maxSize: Long = 200_000,
    private val ttl: Duration = Duration.ofHours(2),
) {
    private val states: Cache<String, CanonicalFlight> =
        Caffeine.newBuilder()
            .maximumSize(maxSize)
            .expireAfterAccess(ttl)
            .build()

    public fun get(icao: String): CanonicalFlight? = states.getIfPresent(icao)

    public fun put(flight: CanonicalFlight): Unit {
        states.put(flight.icao, flight)
    }

    public fun cleanUp(): Unit {
        states.cleanUp()
    }
}
