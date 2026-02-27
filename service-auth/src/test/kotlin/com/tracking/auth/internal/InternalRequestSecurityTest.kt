package com.tracking.auth.internal

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

public class InternalRequestSecurityTest {
    private val security = InternalRequestSecurity("test-internal-key")

    @Test
    public fun `should validate matching internal api key`() {
        assertTrue(security.isValidInternalApiKey("test-internal-key"))
    }

    @Test
    public fun `should reject missing or invalid internal api key`() {
        assertFalse(security.isValidInternalApiKey(null))
        assertFalse(security.isValidInternalApiKey(""))
        assertFalse(security.isValidInternalApiKey("wrong-key"))
    }
}
