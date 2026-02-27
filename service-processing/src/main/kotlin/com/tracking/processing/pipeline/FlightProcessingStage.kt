package com.tracking.processing.pipeline

public fun interface FlightProcessingStage<T> {
    public fun process(input: T): T
}
