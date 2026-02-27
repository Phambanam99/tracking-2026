package com.tracking.gateway

import com.tracking.gateway.config.TrustedProxyConfig
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

public class RoutingIntegrationTest {
    private val trustedProxyConfig: TrustedProxyConfig = TrustedProxyConfig()

    @Test
    public fun `should resolve client ip from x-forwarded-for first hop`() {
        val ip = trustedProxyConfig.resolveClientIp("203.0.113.11, 10.0.0.10", "10.0.0.10")

        assertEquals("203.0.113.11", ip)
    }
}
