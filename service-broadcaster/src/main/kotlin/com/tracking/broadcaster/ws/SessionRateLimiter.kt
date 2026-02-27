package com.tracking.broadcaster.ws

import java.util.concurrent.ConcurrentHashMap

public class SessionRateLimiter(
    private val maxRequestsPerWindow: Int,
    private val windowMillis: Long,
    private val nowProvider: () -> Long = { System.currentTimeMillis() },
) {
    private val sessionWindows: MutableMap<String, WindowState> = ConcurrentHashMap()

    public fun allow(sessionId: String): Boolean {
        if (maxRequestsPerWindow <= 0 || windowMillis <= 0 || sessionId.isBlank()) {
            return false
        }

        val now = nowProvider()
        var allowed = false
        sessionWindows.compute(sessionId) { _, previous ->
            val nextState = when {
                previous == null -> WindowState(windowStartMillis = now, count = 1)
                now - previous.windowStartMillis >= windowMillis -> WindowState(windowStartMillis = now, count = 1)
                previous.count < maxRequestsPerWindow -> previous.copy(count = previous.count + 1)
                else -> previous
            }
            allowed = previous == null ||
                now - previous.windowStartMillis >= windowMillis ||
                previous.count < maxRequestsPerWindow
            nextState
        }
        return allowed
    }

    public fun clear(sessionId: String): Unit {
        sessionWindows.remove(sessionId)
    }

    public fun trackedSessions(): Int = sessionWindows.size

    private data class WindowState(
        val windowStartMillis: Long,
        val count: Int,
    )
}
