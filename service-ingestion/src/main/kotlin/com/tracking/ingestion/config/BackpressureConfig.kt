package com.tracking.ingestion.config

import java.util.concurrent.Semaphore
import kotlin.math.max
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
public class BackpressureConfig(
    private val ingestionProperties: IngestionProperties,
) {
    @Bean(name = ["ingestionAdmissionSemaphore"])
    public fun ingestionAdmissionSemaphore(): Semaphore {
        val maxInFlight = max(1, ingestionProperties.admission.maxInFlight)
        return Semaphore(maxInFlight, true)
    }
}
