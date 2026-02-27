package com.tracking.broadcaster.ws

import com.tracking.broadcaster.config.BroadcasterProperties
import com.tracking.broadcaster.metrics.BroadcasterMetrics
import com.tracking.broadcaster.viewport.ViewportRegistry
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.scheduling.annotation.EnableScheduling

@Configuration
@EnableScheduling
public class BroadcasterWsRuntimeConfig {
    @Bean
    public fun viewportRegistry(): ViewportRegistry = ViewportRegistry()

    @Bean
    public fun sessionRateLimiter(
        broadcasterProperties: BroadcasterProperties,
    ): SessionRateLimiter =
        SessionRateLimiter(
            maxRequestsPerWindow = broadcasterProperties.ws.maxViewportUpdatesPerMinute,
            windowMillis = 60_000,
        )

    @Bean
    public fun staleSessionCleaner(
        viewportRegistry: ViewportRegistry,
        sessionRateLimiter: SessionRateLimiter,
        broadcasterMetrics: BroadcasterMetrics,
        broadcasterProperties: BroadcasterProperties,
    ): StaleSessionCleaner =
        StaleSessionCleaner(
            viewportRegistry = viewportRegistry,
            sessionRateLimiter = sessionRateLimiter,
            broadcasterMetrics = broadcasterMetrics,
            staleTimeoutMillis = broadcasterProperties.cleanup.staleTimeoutMillis,
        )
}
