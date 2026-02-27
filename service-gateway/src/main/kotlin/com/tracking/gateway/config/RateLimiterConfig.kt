package com.tracking.gateway.config

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import reactor.core.publisher.Mono

public data class RateLimitPolicy(
    val routeId: String = "",
    val keyResolver: String = "ip",
    val replenishRatePerSecond: Int,
    val burstCapacity: Int,
)

@ConfigurationProperties(prefix = "tracking.gateway.rate-limit")
public class RateLimiterProperties(
    public var policies: List<RateLimitPolicy> = emptyList(),
)

@Configuration
public class RateLimiterConfig {
    @Bean("gatewayIpKeyResolver")
    @Primary
    public fun ipKeyResolver(trustedProxyConfig: TrustedProxyConfig): KeyResolver {
        return KeyResolver { exchange ->
            Mono.just(trustedProxyConfig.resolveClientIp(exchange))
        }
    }

    @Bean("gatewayApiKeyKeyResolver")
    public fun apiKeyKeyResolver(): KeyResolver {
        return KeyResolver { exchange ->
            Mono.justOrEmpty(exchange.request.headers.getFirst("x-api-key"))
                .map(String::trim)
                .filter { it.isNotEmpty() }
                .defaultIfEmpty("anonymous")
        }
    }

    @Bean("gatewayUserKeyResolver")
    public fun userKeyResolver(trustedProxyConfig: TrustedProxyConfig): KeyResolver {
        return KeyResolver { exchange ->
            Mono.justOrEmpty(exchange.request.headers.getFirst("X-Auth-User"))
                .filter { it.isNotBlank() }
                .switchIfEmpty(Mono.just(trustedProxyConfig.resolveClientIp(exchange)))
        }
    }

    public fun loginPolicy(properties: RateLimiterProperties = RateLimiterProperties()): RateLimitPolicy {
        return properties.policies.firstOrNull { it.routeId == LOGIN_ROUTE_ID }
            ?: RateLimitPolicy(
                routeId = LOGIN_ROUTE_ID,
                keyResolver = "ip",
                replenishRatePerSecond = 5,
                burstCapacity = 10,
            )
    }

    private companion object {
        private const val LOGIN_ROUTE_ID: String = "auth-login-route"
    }
}
