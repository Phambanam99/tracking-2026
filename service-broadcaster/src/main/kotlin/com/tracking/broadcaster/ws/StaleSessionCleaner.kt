package com.tracking.broadcaster.ws

import com.tracking.broadcaster.metrics.BroadcasterMetrics
import com.tracking.broadcaster.viewport.ViewportRegistry
import org.springframework.scheduling.annotation.Scheduled

public class StaleSessionCleaner(
    private val viewportRegistry: ViewportRegistry,
    private val sessionRateLimiter: SessionRateLimiter,
    private val broadcasterMetrics: BroadcasterMetrics,
    private val staleTimeoutMillis: Long,
) {
    @Scheduled(fixedDelayString = "\${tracking.broadcaster.cleanup.interval-millis:30000}")
    public fun clean(): Unit {
        val removedSessions = viewportRegistry.removeStaleSessions(staleTimeoutMillis)
        removedSessions.forEach { session -> sessionRateLimiter.clear(session.sessionId) }
        broadcasterMetrics.incrementSessionsCleaned(removedSessions.size)
    }
}
