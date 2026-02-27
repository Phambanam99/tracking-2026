package com.tracking.auth.api

import com.tracking.auth.security.JwksKeyProvider
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/auth")
public class JwksController(
    private val jwksKeyProvider: JwksKeyProvider,
) {
    @GetMapping("/.well-known/jwks.json")
    public fun jwks(): Map<String, Any> = jwksKeyProvider.jwks()
}
