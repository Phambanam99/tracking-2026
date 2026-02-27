package com.tracking.processing.state

import com.tracking.common.dto.CanonicalFlight
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import java.time.Duration
import kotlin.test.Test

public class LastKnownStateStoreTest {
    @Test
    public fun `should return previously stored state`() {
        val store = LastKnownStateStore(maxSize = 100, ttl = Duration.ofSeconds(1))
        val flight = flight(eventTime = 1_000L)

        store.put(flight)

        store.get(flight.icao) shouldBe flight
    }

    @Test
    public fun `should evict stale state after ttl`() {
        val store = LastKnownStateStore(maxSize = 100, ttl = Duration.ofMillis(50))
        val flight = flight(eventTime = 1_000L)
        store.put(flight)

        Thread.sleep(120)
        store.cleanUp()

        store.get(flight.icao).shouldBeNull()
    }

    private fun flight(eventTime: Long): CanonicalFlight =
        CanonicalFlight(
            icao = "ABC123",
            lat = 21.0,
            lon = 105.0,
            eventTime = eventTime,
            sourceId = "radar-1",
        )
}
