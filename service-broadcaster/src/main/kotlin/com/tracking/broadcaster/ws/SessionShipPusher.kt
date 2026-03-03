package com.tracking.broadcaster.ws

import com.tracking.broadcaster.viewport.ViewportSession
import com.tracking.common.dto.EnrichedShip

public fun interface SessionShipPusher {
    public fun push(session: ViewportSession, ship: EnrichedShip): Boolean
}
