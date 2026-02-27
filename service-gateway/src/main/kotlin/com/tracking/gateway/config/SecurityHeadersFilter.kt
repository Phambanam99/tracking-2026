package com.tracking.gateway.config

import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.core.Ordered
import org.springframework.http.server.reactive.ServerHttpRequest
import org.springframework.stereotype.Component
import reactor.core.publisher.Mono

@Component
public class SecurityHeadersFilter : GlobalFilter, Ordered {
    public fun defaultHeaders(): Map<String, String> {
        return mapOf(
            "X-Content-Type-Options" to "nosniff",
            "X-Frame-Options" to "DENY",
            "Referrer-Policy" to "strict-origin-when-cross-origin",
            "X-XSS-Protection" to "0",
            "Permissions-Policy" to "camera=(), microphone=(), geolocation=()",
            "Content-Security-Policy" to "default-src 'none'; frame-ancestors 'none'",
        )
    }

    override fun getOrder(): Int = Ordered.LOWEST_PRECEDENCE - 10

    override fun filter(
        exchange: org.springframework.web.server.ServerWebExchange,
        chain: org.springframework.cloud.gateway.filter.GatewayFilterChain,
    ): Mono<Void> {
        exchange.response.beforeCommit {
            Mono.fromRunnable {
                val headers = exchange.response.headers
                defaultHeaders().forEach { (name, value) ->
                    if (!headers.containsKey(name)) {
                        headers.add(name, value)
                    }
                }
                if (isSecureRequest(exchange.request)) {
                    if (!headers.containsKey("Strict-Transport-Security")) {
                        headers.add("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
                    }
                }
            }
        }
        return chain.filter(exchange)
    }

    private fun isSecureRequest(request: ServerHttpRequest): Boolean {
        val fromUri = request.uri.scheme.equals("https", ignoreCase = true)
        if (fromUri) {
            return true
        }

        val forwardedProto = request.headers.getFirst("X-Forwarded-Proto")
        return forwardedProto.equals("https", ignoreCase = true)
    }
}
