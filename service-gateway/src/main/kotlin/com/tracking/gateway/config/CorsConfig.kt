package com.tracking.gateway.config

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.reactive.CorsWebFilter
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource

@Configuration
public class CorsConfig {
    @Bean
    public fun corsWebFilter(properties: GatewayCorsProperties): CorsWebFilter {
        val corsConfiguration = CorsConfiguration().apply {
            allowedOrigins = properties.allowedOrigins
            allowedMethods = properties.allowedMethods
            allowedHeaders = properties.allowedHeaders
            exposedHeaders = properties.exposedHeaders
            allowCredentials = properties.allowCredentials
            maxAge = properties.maxAgeSeconds
        }

        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/**", corsConfiguration)

        return CorsWebFilter(source)
    }
}

@ConfigurationProperties(prefix = "tracking.gateway.cors")
public class GatewayCorsProperties(
    public var allowedOrigins: List<String> = listOf("http://localhost:5173"),
    public var allowedMethods: List<String> = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"),
    public var allowedHeaders: List<String> = listOf("Authorization", "Content-Type", "x-api-key", "x-request-id", "traceparent"),
    public var exposedHeaders: List<String> = listOf("x-request-id"),
    public var allowCredentials: Boolean = true,
    public var maxAgeSeconds: Long = 3600,
)
