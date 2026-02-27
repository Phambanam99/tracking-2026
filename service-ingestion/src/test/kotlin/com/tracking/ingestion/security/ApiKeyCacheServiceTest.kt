package com.tracking.ingestion.security

import com.tracking.ingestion.config.IngestionProperties
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

public class ApiKeyCacheServiceTest {
    @Test
    public fun `should cache api key by fingerprint and resolve principal`() {
        val cacheService = ApiKeyCacheService(ingestionProperties())

        cacheService.cache("plain-api-key", ApiKeyPrincipal(sourceId = "SRC-1"))

        val principal = cacheService.getIfPresent("plain-api-key")
        assertNotNull(principal)
        assertEquals("SRC-1", principal?.sourceId)
    }

    @Test
    public fun `should block cached api key after source revocation`() {
        val cacheService = ApiKeyCacheService(ingestionProperties())
        cacheService.cache("plain-api-key", ApiKeyPrincipal(sourceId = "SRC-2"))

        cacheService.revokeSourceId("SRC-2")

        assertTrue(cacheService.isSourceRevoked("SRC-2"))
        assertNull(cacheService.getIfPresent("plain-api-key"))
        assertFalse(cacheService.isSourceRevoked("SRC-3"))
    }

    private fun ingestionProperties(): IngestionProperties {
        val properties = IngestionProperties()
        properties.security.cacheTtlSeconds = 60
        properties.security.revocationSourceTtlSeconds = 900
        return properties
    }
}
