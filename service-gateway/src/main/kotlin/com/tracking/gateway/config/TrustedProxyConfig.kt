package com.tracking.gateway.config

public class TrustedProxyConfig {
    public fun resolveClientIp(xForwardedFor: String?, remoteAddr: String): String {
        val firstForwardedIp = xForwardedFor
            ?.split(',')
            ?.firstOrNull()
            ?.trim()
            ?.takeIf { it.isNotEmpty() }

        return firstForwardedIp ?: remoteAddr
    }
}
