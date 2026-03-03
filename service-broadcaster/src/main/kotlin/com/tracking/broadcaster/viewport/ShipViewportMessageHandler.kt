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
public class ShipViewportMessageHandler(
    private val viewportRegistry: ViewportRegistry,
    private val sessionRateLimiter: SessionRateLimiter,
    private val broadcasterMetrics: BroadcasterMetrics,
) {
    @MessageMapping("ship-viewport")
    public fun updateViewport(
        @Payload viewport: BoundingBox,
        @Header("simpSessionId") sessionId: String,
        principal: Optional<Principal>,
    ): Unit {
        require(viewport.north in -90.0..90.0) { "north out of range" }
        require(viewport.south in -90.0..90.0) { "south out of range" }
        require(viewport.east in -180.0..180.0) { "east out of range" }
        require(viewport.west in -180.0..180.0) { "west out of range" }
        require(viewport.north >= viewport.south) { "north must be >= south" }
        require(viewport.east >= viewport.west) { "east must be >= west" }

        if (!sessionRateLimiter.allow(sessionId)) {
            throw MessageDeliveryException("Viewport update rate exceeded for session=$sessionId")
        }

        val principalName = principal
            .map { value -> value.name }
            .filter { value -> value.isNotBlank() }
            .orElse(sessionId)
        viewportRegistry.register(sessionId, principalName, viewport, TrackingMode.SHIP)
        broadcasterMetrics.incrementViewportUpdates()
    }
}
