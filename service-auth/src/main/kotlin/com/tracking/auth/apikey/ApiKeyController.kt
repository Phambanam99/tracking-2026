package com.tracking.auth.apikey

import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/auth/api-keys")
public class ApiKeyController(
    private val apiKeyService: ApiKeyService,
) {
    @PostMapping
    public fun createApiKey(
        @Valid @RequestBody request: CreateApiKeyRequest,
    ): CreateApiKeyResponse {
        val issuedApiKey = apiKeyService.createApiKey(request.sourceId)
        return CreateApiKeyResponse(
            id = issuedApiKey.id,
            sourceId = issuedApiKey.sourceId,
            apiKey = issuedApiKey.plaintextApiKey,
            active = issuedApiKey.active,
        )
    }

    @PostMapping("/{id}/revoke")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public fun revokeApiKey(@PathVariable id: Long): Unit = apiKeyService.revokeApiKey(id)
}

public data class CreateApiKeyRequest(
    @field:NotBlank
    val sourceId: String,
)

public data class CreateApiKeyResponse(
    val id: Long,
    val sourceId: String,
    val apiKey: String,
    val active: Boolean,
)
