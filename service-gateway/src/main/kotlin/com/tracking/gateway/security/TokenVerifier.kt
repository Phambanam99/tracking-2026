package com.tracking.gateway.security

import java.time.Instant
import reactor.core.publisher.Mono

public data class TokenPrincipal(
    val subject: String,
    val roles: Set<String>,
    val tokenId: String,
    val expiresAt: Instant,
)

public interface TokenVerifier {
    public fun verify(token: String): Mono<TokenPrincipal>
}
