package com.tracking.processing.routing

import com.tracking.processing.eventtime.EventTimeDecision

public class TopicRouter {
    public fun route(decision: EventTimeDecision): String {
        return when (decision) {
            EventTimeDecision.LIVE -> LIVE_TOPIC
            EventTimeDecision.HISTORICAL -> HISTORICAL_TOPIC
        }
    }

    public companion object {
        public const val LIVE_TOPIC: String = "live-adsb"
        public const val HISTORICAL_TOPIC: String = "historical-adsb"
    }
}
