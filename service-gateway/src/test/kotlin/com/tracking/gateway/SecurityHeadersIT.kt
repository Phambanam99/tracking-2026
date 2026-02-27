package com.tracking.gateway

import com.tracking.gateway.config.SecurityHeadersFilter
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

public class SecurityHeadersIT {
    @Test
    public fun `should provide secure default headers`() {
        val headers = SecurityHeadersFilter().defaultHeaders()

        assertEquals("nosniff", headers["X-Content-Type-Options"])
        assertEquals("DENY", headers["X-Frame-Options"])
        assertEquals("strict-origin-when-cross-origin", headers["Referrer-Policy"])
        assertEquals("0", headers["X-XSS-Protection"])
        assertEquals("camera=(), microphone=(), geolocation=()", headers["Permissions-Policy"])
    }
}
