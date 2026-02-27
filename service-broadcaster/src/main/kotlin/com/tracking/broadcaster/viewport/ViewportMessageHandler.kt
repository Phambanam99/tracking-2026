package com.tracking.broadcaster.viewport

import com.tracking.broadcaster.metrics.BroadcasterMetrics
import com.tracking.broadcaster.ws.SessionRateLimiter
import com.tracking.common.dto.BoundingBox
import java.security.Principal
import java.util.Optional
import org.springframework.messaging.MessageDeliveryException
import org.springframework.messaging.handler.annotation.Header
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.messaging.handler.annotation.Payload
import org.springframework.stereotype.Controller

@Controller
public class ViewportMessageHandler(
    private val viewportRegistry: ViewportRegistry,
    private val sessionRateLimiter: SessionRateLimiter,
    private val broadcasterMetrics: BroadcasterMetrics,
) {
    @MessageMapping("viewport")
    public fun updateViewport(
        @Payload viewport: BoundingBox,
        @Header("simpSessionId") sessionId: String,
        principal: Optional<Principal>,
    ): Unit {
        validateViewport(viewport)

        if (!sessionRateLimiter.allow(sessionId)) {
            throw MessageDeliveryException("Viewport update rate exceeded for session=$sessionId")
        }

        val principalName = principal
            .map { value -> value.name }
            .filter { value -> value.isNotBlank() }
            .orElse(sessionId)
        viewportRegistry.register(sessionId, principalName, viewport)
        broadcasterMetrics.incrementViewportUpdates()
    }

    private fun validateViewport(viewport: BoundingBox): Unit {
        require(viewport.north in LATITUDE_MIN..LATITUDE_MAX) { "north out of range" }
        require(viewport.south in LATITUDE_MIN..LATITUDE_MAX) { "south out of range" }
        require(viewport.east in LONGITUDE_MIN..LONGITUDE_MAX) { "east out of range" }
        require(viewport.west in LONGITUDE_MIN..LONGITUDE_MAX) { "west out of range" }
        require(viewport.north >= viewport.south) { "north must be >= south" }
        require(viewport.east >= viewport.west) { "east must be >= west" }
    }

    private companion object {
        private const val LATITUDE_MIN: Double = -90.0
        private const val LATITUDE_MAX: Double = 90.0
        private const val LONGITUDE_MIN: Double = -180.0
        private const val LONGITUDE_MAX: Double = 180.0
    }
}
