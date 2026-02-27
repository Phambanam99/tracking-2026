package com.tracking.auth.internal

import com.tracking.auth.api.AuthService
import com.tracking.auth.api.TokenVerifyRequest
import com.tracking.auth.api.TokenVerifyResponse
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/internal/v1/tokens")
public class InternalTokenController(
    private val authService: AuthService,
) {
    @PostMapping("/verify")
    public fun verifyToken(
        @Valid @RequestBody request: TokenVerifyRequest,
    ): TokenVerifyResponse = authService.verifyToken(request)
}
