package com.tracking.gateway.config

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.stereotype.Component
import org.springframework.web.util.pattern.PathPattern
import org.springframework.web.util.pattern.PathPatternParser

@Component
@ConfigurationProperties(prefix = "tracking.gateway.routes")
public class GatewayRoutesConfig(
    public var authPath: String = "/api/v1/auth/**",
    public var ingestPath: String = "/api/v1/ingest/**",
    public var websocketPath: String = "/ws/live/**",
    public var jwtProtectedPaths: List<String> = listOf("/api/v1/auth/**", "/ws/live/**"),
    public var apiKeyProtectedPaths: List<String> = listOf("/api/v1/ingest/**"),
    public var publicAuthPaths: List<String> = listOf(
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        "/api/v1/auth/.well-known/jwks.json",
    ),
) {
    private val parser: PathPatternParser = PathPatternParser.defaultInstance

    public fun requiresJwt(path: String): Boolean {
        if (isPublicAuthPath(path)) {
            return false
        }

        return jwtProtectedPaths.any { pattern -> matches(path, pattern) }
    }

    public fun requiresApiKey(path: String): Boolean {
        return apiKeyProtectedPaths.any { pattern -> matches(path, pattern) }
    }

    public fun isPublicAuthPath(path: String): Boolean {
        return publicAuthPaths.any { pattern ->
            path == pattern || path.startsWith("$pattern/")
        }
    }

    private fun matches(path: String, pattern: String): Boolean {
        val pathPattern: PathPattern = parser.parse(pattern)
        return pathPattern.matches(parser.parsePath(path))
    }
}
