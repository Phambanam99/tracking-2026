package com.tracking.processing.eventtime

public class EventTimeResolver {
    public fun resolve(previousEventTime: Long?, candidateEventTime: Long): EventTimeDecision {
        return if (previousEventTime != null && candidateEventTime < previousEventTime) {
            EventTimeDecision.HISTORICAL
        } else {
            EventTimeDecision.LIVE
        }
    }
}

public enum class EventTimeDecision {
    LIVE,
    HISTORICAL,
}
