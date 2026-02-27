package com.tracking.gateway.filter

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

public class ApiKeyFilterTest {
    private val filter: ApiKeyFilter = ApiKeyFilter()

    @Test
    public fun `should extract non-empty api key`() {
        assertEquals("key-123", filter.extractApiKey(" key-123 "))
    }

    @Test
    public fun `should return null for empty api key`() {
        assertNull(filter.extractApiKey("   "))
        assertNull(filter.extractApiKey(null))
    }
}
