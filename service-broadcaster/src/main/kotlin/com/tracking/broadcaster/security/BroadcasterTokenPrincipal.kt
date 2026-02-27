package com.tracking.broadcaster.security

import java.time.Instant

public data class BroadcasterTokenPrincipal(
    val subject: String,
    val tokenId: String,
    val roles: Set<String>,
    val expiresAt: Instant,
)
