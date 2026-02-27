package com.tracking.gateway.config

public data class RateLimitPolicy(
    val replenishRatePerSecond: Int,
    val burstCapacity: Int,
)

public class RateLimiterConfig {
    public fun loginPolicy(): RateLimitPolicy {
        return RateLimitPolicy(replenishRatePerSecond = 5, burstCapacity = 10)
    }
}
