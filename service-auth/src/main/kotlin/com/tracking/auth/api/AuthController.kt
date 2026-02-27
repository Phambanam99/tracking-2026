package com.tracking.auth.api

import jakarta.validation.Valid
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController(
        private val authService: AuthService,
) {
    @PostMapping("/register")
    public fun register(
            @Valid @RequestBody request: RegisterRequest,
    ): AuthTokensResponse = authService.register(request)

    @PostMapping("/login")
    public fun login(
            @Valid @RequestBody request: LoginRequest,
    ): AuthTokensResponse = authService.login(request)

    @PostMapping("/refresh-token")
    public fun refreshToken(
            @Valid @RequestBody request: RefreshTokenRequest,
    ): AuthTokensResponse = authService.refresh(request)

    @PostMapping("/logout")
    public fun logout(
            @Valid @RequestBody request: LogoutRequest,
    ): Unit = authService.logout(request)
}
