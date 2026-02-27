package com.tracking.broadcaster.metrics

import com.tracking.broadcaster.viewport.ViewportRegistry
import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Timer
import java.util.concurrent.TimeUnit
import org.springframework.stereotype.Component

@Component
public class BroadcasterMetrics(
    meterRegistry: MeterRegistry,
    viewportRegistry: ViewportRegistry,
) {
    private val pushedCounter: Counter = meterRegistry.counter("ws.messages.pushed")
    private val rejectedJwtCounter: Counter = meterRegistry.counter("ws.sessions.rejected_jwt")
    private val viewportUpdateCounter: Counter = meterRegistry.counter("ws.viewport.updates")
    private val cleanedCounter: Counter = meterRegistry.counter("ws.sessions.cleaned")
    private val pushLatencyTimer: Timer = meterRegistry.timer("ws.push.latency")

    init {
        Gauge.builder("ws.sessions.active") { viewportRegistry.activeSessions().toDouble() }
            .register(meterRegistry)
    }

    public fun incrementMessagesPushed(): Unit = pushedCounter.increment()

    public fun incrementRejectedJwt(): Unit = rejectedJwtCounter.increment()

    public fun incrementViewportUpdates(): Unit = viewportUpdateCounter.increment()

    public fun incrementSessionsCleaned(amount: Int): Unit {
        if (amount > 0) {
            cleanedCounter.increment(amount.toDouble())
        }
    }

    public fun recordPushLatencyNanos(nanos: Long): Unit =
        pushLatencyTimer.record(nanos.coerceAtLeast(0L), TimeUnit.NANOSECONDS)
}
