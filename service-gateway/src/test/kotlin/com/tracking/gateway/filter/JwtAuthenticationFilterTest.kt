package com.tracking.gateway.filter

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

public class JwtAuthenticationFilterTest {
    private val filter: JwtAuthenticationFilter = JwtAuthenticationFilter()

    @Test
    public fun `should extract jwt from bearer header`() {
        assertEquals("jwt-token", filter.extractBearerToken("Bearer jwt-token"))
    }

    @Test
    public fun `should return null when header is invalid`() {
        assertNull(filter.extractBearerToken("Basic abc"))
        assertNull(filter.extractBearerToken(null))
    }
}
