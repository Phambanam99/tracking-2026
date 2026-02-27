package com.tracking.broadcaster.ws

import com.tracking.broadcaster.viewport.ViewportRegistry
import org.springframework.context.event.EventListener
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.stereotype.Component
import org.springframework.web.socket.messaging.SessionDisconnectEvent

@Component
public class SessionDisconnectHandler(
    private val viewportRegistry: ViewportRegistry,
    private val sessionRateLimiter: SessionRateLimiter,
) {
    @EventListener
    public fun onDisconnect(event: SessionDisconnectEvent): Unit {
        val accessor = StompHeaderAccessor.wrap(event.message)
        val sessionId = accessor.sessionId ?: return
        viewportRegistry.unregister(sessionId)
        sessionRateLimiter.clear(sessionId)
    }
}
