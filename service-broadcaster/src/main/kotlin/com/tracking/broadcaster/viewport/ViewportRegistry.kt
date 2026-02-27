package com.tracking.broadcaster.viewport

import com.tracking.common.dto.BoundingBox
import java.util.concurrent.ConcurrentHashMap

public class ViewportRegistry(
    private val nowProvider: () -> Long = { System.currentTimeMillis() },
) {
    private val sessions: MutableMap<String, SessionViewportState> = ConcurrentHashMap()

    public fun register(sessionId: String, principalName: String, viewport: BoundingBox): Unit {
        val normalizedSessionId = sessionId.trim()
        val normalizedPrincipalName = principalName.trim()
        if (normalizedSessionId.isEmpty()) {
            return
        }

        sessions[normalizedSessionId] = SessionViewportState(
            principalName = normalizedPrincipalName.ifBlank { normalizedSessionId },
            viewport = viewport,
            lastActivityEpochMillis = nowProvider(),
        )
    }

    public fun unregister(sessionId: String): Boolean = sessions.remove(sessionId.trim()) != null

    public fun clear(): Unit = sessions.clear()

    public fun touch(sessionId: String): Unit {
        val normalizedSessionId = sessionId.trim()
        if (normalizedSessionId.isEmpty()) {
            return
        }

        sessions.computeIfPresent(normalizedSessionId) { _, current ->
            current.copy(lastActivityEpochMillis = nowProvider())
        }
    }

    public fun sessionsContaining(lat: Double, lon: Double): List<ViewportSession> {
        return sessions.entries
            .asSequence()
            .filter { (_, state) -> state.viewport.contains(lat, lon) }
            .map { (sessionId, state) -> state.toSession(sessionId) }
            .toList()
    }

    public fun removeStaleSessions(staleTimeoutMillis: Long): List<ViewportSession> {
        if (staleTimeoutMillis <= 0) {
            return emptyList()
        }

        val staleBeforeMillis = nowProvider() - staleTimeoutMillis
        val removed: MutableList<ViewportSession> = mutableListOf()
        sessions.entries.forEach { (sessionId, state) ->
            if (state.lastActivityEpochMillis < staleBeforeMillis && sessions.remove(sessionId, state)) {
                removed.add(state.toSession(sessionId))
            }
        }
        return removed
    }

    public fun activeSessions(): Int = sessions.size

    public fun isRegistered(sessionId: String): Boolean = sessions.containsKey(sessionId.trim())

    private data class SessionViewportState(
        val principalName: String,
        val viewport: BoundingBox,
        val lastActivityEpochMillis: Long,
    ) {
        fun toSession(sessionId: String): ViewportSession = ViewportSession(
            sessionId = sessionId,
            principalName = principalName,
            viewport = viewport,
            lastActivityEpochMillis = lastActivityEpochMillis,
        )
    }
}

public data class ViewportSession(
    val sessionId: String,
    val principalName: String,
    val viewport: BoundingBox,
    val lastActivityEpochMillis: Long,
)
