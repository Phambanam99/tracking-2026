package com.tracking.auth.api

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size

public data class RegisterRequest(
    @field:NotBlank
    val username: String,
    @field:Email
    @field:NotBlank
    val email: String,
    @field:NotBlank
    @field:Size(min = 12, max = 128)
    @field:Pattern(
        regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{12,}$",
        message = "Password must be at least 12 characters, include upper and lower case letters, a number and a special character",
    )
    val password: String,
)

public data class LoginRequest(
    @field:NotBlank
    val username: String,
    @field:NotBlank
    val password: String,
)

public data class RefreshTokenRequest(
    @field:NotBlank
    val refreshToken: String,
)

public data class LogoutRequest(
    @field:NotBlank
    val refreshToken: String,
)

public data class AuthTokensResponse(
    val accessToken: String,
    val refreshToken: String,
)

public data class TokenVerifyRequest(
    @field:NotBlank
    val token: String,
)

public data class TokenVerifyResponse(
    val valid: Boolean,
    val username: String? = null,
    val roles: Set<String> = emptySet(),
)

public data class ApiKeyVerifyRequest(
    @field:NotBlank
    val apiKey: String,
)

public data class ApiKeyVerifyResponse(
    val valid: Boolean,
    val sourceId: String? = null,
)
