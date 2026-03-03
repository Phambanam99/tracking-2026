package com.tracking.broadcaster.ws

import com.tracking.broadcaster.metrics.BroadcasterMetrics
import com.tracking.broadcaster.viewport.ViewportSession
import com.tracking.common.dto.EnrichedShip
import com.tracking.common.dto.LiveShipMessage
import org.springframework.messaging.simp.SimpMessageHeaderAccessor
import org.springframework.messaging.simp.SimpMessageType
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service

@Service
public class ShipSessionPushService(
    private val messagingTemplate: SimpMessagingTemplate,
    private val broadcasterMetrics: BroadcasterMetrics,
) : SessionShipPusher {
    override fun push(session: ViewportSession, ship: EnrichedShip): Boolean {
        val startedNanos = System.nanoTime()
        val pushed = runCatching {
            val headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE)
            headers.sessionId = session.sessionId
            headers.setLeaveMutable(true)

            messagingTemplate.convertAndSendToUser(
                session.principalName,
                DESTINATION_SHIPS,
                LiveShipMessage(sentAt = System.currentTimeMillis(), ship = ship),
                headers.messageHeaders,
            )
            true
        }.getOrDefault(false)

        broadcasterMetrics.recordPushLatencyNanos(System.nanoTime() - startedNanos)
        if (pushed) {
            broadcasterMetrics.incrementMessagesPushed()
        }
        return pushed
    }

    private companion object {
        private const val DESTINATION_SHIPS: String = "/topic/ships"
    }
}
