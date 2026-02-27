package com.tracking.processing.enrich

import com.tracking.common.dto.AircraftMetadata
import java.time.Duration
import java.time.Instant
import java.util.concurrent.atomic.AtomicReference

public class ReferenceDataCache(
    private val loader: ReferenceDataLoader,
    private val refreshInterval: Duration = Duration.ofMinutes(10),
    private val nowProvider: () -> Instant = { Instant.now() },
) {
    private val data: AtomicReference<Map<String, AircraftMetadata>> = AtomicReference(emptyMap())
    private val refreshLock: Any = Any()
    @Volatile
    private var nextRefreshAt: Instant = Instant.MIN

    init {
        refreshNow()
    }

    public fun findByIcao(icao: String): AircraftMetadata? {
        refreshIfNeeded()
        return data.get()[icao]
    }

    public fun refreshNow(): Unit {
        synchronized(refreshLock) {
            val loaded = loader.load()
            data.set(loaded)
            nextRefreshAt = nowProvider().plus(refreshInterval)
        }
    }

    private fun refreshIfNeeded() {
        if (nowProvider().isBefore(nextRefreshAt)) {
            return
        }
        synchronized(refreshLock) {
            if (nowProvider().isBefore(nextRefreshAt)) {
                return
            }
            val loaded = loader.load()
            data.set(loaded)
            nextRefreshAt = nowProvider().plus(refreshInterval)
        }
    }
}
