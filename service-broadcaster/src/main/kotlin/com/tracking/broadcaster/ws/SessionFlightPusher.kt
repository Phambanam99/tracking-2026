package com.tracking.broadcaster.ws

import com.tracking.common.dto.EnrichedFlight
import com.tracking.broadcaster.viewport.ViewportSession

public fun interface SessionFlightPusher {
    public fun push(session: ViewportSession, flight: EnrichedFlight): Boolean
}
