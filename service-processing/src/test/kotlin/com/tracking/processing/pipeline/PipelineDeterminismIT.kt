package com.tracking.processing.pipeline

import io.kotest.matchers.shouldBe
import kotlin.test.Test

public class PipelineDeterminismIT {
    @Test
    public fun `should execute stages in deterministic order`() {
        val executor =
            PipelineExecutor(
                listOf(
                    FlightProcessingStage { input: Int -> input + 2 },
                    FlightProcessingStage { input: Int -> input * 3 },
                    FlightProcessingStage { input: Int -> input - 1 },
                ),
            )

        val first = executor.execute(10)
        val second = executor.execute(10)

        first shouldBe 35
        second shouldBe 35
    }
}
