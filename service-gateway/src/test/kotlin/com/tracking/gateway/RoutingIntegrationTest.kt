package com.tracking.gateway

import com.tracking.gateway.config.TrustedProxyConfig
import com.tracking.gateway.config.TrustedProxyProperties
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

public class RoutingIntegrationTest {
    private val trustedProxyConfig: TrustedProxyConfig = TrustedProxyConfig(
        properties = TrustedProxyProperties(
            cidrs = listOf("10.0.0.0/8", "127.0.0.1/32"),
        ),
    )

    @Test
    public fun `should resolve client ip from x-forwarded-for first hop for trusted proxy`() {
        val ip = trustedProxyConfig.resolveClientIp("203.0.113.11, 10.0.0.10", "10.0.0.10")

        assertEquals("203.0.113.11", ip)
    }

    @Test
    public fun `should ignore x-forwarded-for for untrusted proxy`() {
        val ip = trustedProxyConfig.resolveClientIp("203.0.113.11", "198.51.100.20")

        assertEquals("198.51.100.20", ip)
    }
}
