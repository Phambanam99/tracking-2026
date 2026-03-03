package com.tracking.processing.state

import com.github.benmanes.caffeine.cache.Cache
import com.github.benmanes.caffeine.cache.Caffeine
import com.tracking.common.dto.CanonicalShip
import java.time.Duration

public class ShipLastKnownStateStore(
    private val maxSize: Long = 200_000,
    private val ttl: Duration = Duration.ofHours(2),
) {
    private val states: Cache<String, CanonicalShip> =
        Caffeine.newBuilder()
            .maximumSize(maxSize)
            .expireAfterAccess(ttl)
            .build()

    public fun get(mmsi: String): CanonicalShip? = states.getIfPresent(mmsi)

    public fun put(ship: CanonicalShip): Unit {
        states.put(ship.mmsi, ship)
    }

    public fun cleanUp(): Unit {
        states.cleanUp()
    }
}
