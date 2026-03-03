package com.tracking.processing.routing

import com.tracking.processing.eventtime.EventTimeDecision

public class ShipTopicRouter(
    private val liveTopic: String = LIVE_TOPIC,
    private val historicalTopic: String = HISTORICAL_TOPIC,
) {
    public fun route(decision: EventTimeDecision): String {
        return when (decision) {
            EventTimeDecision.LIVE -> liveTopic
            EventTimeDecision.HISTORICAL -> historicalTopic
        }
    }

    public companion object {
        public const val LIVE_TOPIC: String = "live-ais"
        public const val HISTORICAL_TOPIC: String = "historical-ais"
    }
}
