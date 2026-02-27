package com.tracking.ingestion.failure

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.ingestion.config.IngestionProperties
import com.tracking.ingestion.metrics.IngestionMetrics
import com.tracking.ingestion.security.ApiKeyCacheService
import com.tracking.ingestion.security.ApiKeyPrincipal
import com.tracking.ingestion.security.ApiKeyRevocationConsumer
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

public class RebalanceBehaviorIT {
    @Test
    public fun `should stay consistent when revocation event is re-delivered after rebalance`() {
        val cacheService = ApiKeyCacheService(IngestionProperties())
        cacheService.cache("api-key", ApiKeyPrincipal(sourceId = "SRC-REB-1"))
        val consumer = ApiKeyRevocationConsumer(
            objectMapper = ObjectMapper(),
            apiKeyCacheService = cacheService,
            ingestionMetrics = IngestionMetrics(SimpleMeterRegistry()),
        )
        val revocationPayload = """{"type":"API_KEY_REVOKED","sourceId":"SRC-REB-1"}"""

        consumer.consume(revocationPayload)
        consumer.consume(revocationPayload)

        assertTrue(cacheService.isSourceRevoked("SRC-REB-1"))
        assertNull(cacheService.getIfPresent("api-key"))
    }
}
