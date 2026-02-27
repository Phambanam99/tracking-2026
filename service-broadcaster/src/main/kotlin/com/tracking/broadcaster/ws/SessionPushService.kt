package com.tracking.broadcaster.ws

import com.tracking.broadcaster.metrics.BroadcasterMetrics
import com.tracking.broadcaster.viewport.ViewportSession
import com.tracking.common.dto.EnrichedFlight
import com.tracking.common.dto.LiveFlightMessage
import org.springframework.messaging.simp.SimpMessageHeaderAccessor
import org.springframework.messaging.simp.SimpMessageType
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service

@Service
public class SessionPushService(
    private val messagingTemplate: SimpMessagingTemplate,
    private val broadcasterMetrics: BroadcasterMetrics,
) : SessionFlightPusher {
    override fun push(session: ViewportSession, flight: EnrichedFlight): Boolean {
        val startedNanos = System.nanoTime()
        val pushed = runCatching {
            val headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE)
            headers.sessionId = session.sessionId
            headers.setLeaveMutable(true)

            messagingTemplate.convertAndSendToUser(
                session.principalName,
                DESTINATION_FLIGHTS,
                LiveFlightMessage(sentAt = System.currentTimeMillis(), flight = flight),
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
        private const val DESTINATION_FLIGHTS: String = "/topic/flights"
    }
}
