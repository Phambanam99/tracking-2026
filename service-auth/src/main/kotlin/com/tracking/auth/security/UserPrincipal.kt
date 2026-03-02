package com.tracking.auth.security

public data class UserPrincipal(
    val id: Long,
    val username: String,
    val roles: Set<String>,
)
