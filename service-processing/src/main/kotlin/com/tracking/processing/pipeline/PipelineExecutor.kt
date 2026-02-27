package com.tracking.processing.pipeline

public class PipelineExecutor<T>(
    private val stages: List<FlightProcessingStage<T>>,
) {
    public fun execute(input: T): T {
        return stages.fold(input) { current, stage ->
            stage.process(current)
        }
    }
}
