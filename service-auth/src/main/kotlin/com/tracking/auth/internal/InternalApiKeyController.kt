package com.tracking.auth.internal

import com.tracking.auth.api.ApiKeyVerifyRequest
import com.tracking.auth.api.ApiKeyVerifyResponse
import com.tracking.auth.apikey.ApiKeyService
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/internal/v1/api-keys")
public class InternalApiKeyController(
    private val apiKeyService: ApiKeyService,
) {
    @PostMapping("/verify")
    public fun verifyApiKey(
        @Valid @RequestBody request: ApiKeyVerifyRequest,
    ): ApiKeyVerifyResponse = apiKeyService.verifyApiKey(request.apiKey)
}
