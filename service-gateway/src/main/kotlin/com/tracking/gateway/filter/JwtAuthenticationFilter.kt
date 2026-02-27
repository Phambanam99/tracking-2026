package com.tracking.gateway.filter

public class JwtAuthenticationFilter {
    public fun extractBearerToken(header: String?): String? {
        if (header == null) {
            return null
        }

        val prefix = "Bearer "
        if (!header.startsWith(prefix)) {
            return null
        }

        val token = header.removePrefix(prefix).trim()
        return token.takeIf { it.isNotEmpty() }
    }
}
