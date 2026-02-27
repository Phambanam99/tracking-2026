package com.tracking.auth.internal

import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import org.springframework.web.server.ResponseStatusException
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import jakarta.annotation.PostConstruct

@Component
public class InternalRequestSecurity(
    @Value("\${auth.internal-api-key}")
    private val internalApiKey: String,
) {
    @PostConstruct
    public fun validateConfiguration(): Unit {
        if (internalApiKey.isBlank()) {
            throw IllegalStateException("auth.internal-api-key must not be blank")
        }
    }

    public fun isValidInternalApiKey(providedApiKey: String?): Boolean {
        if (providedApiKey.isNullOrBlank()) {
            return false
        }

        return MessageDigest.isEqual(
            internalApiKey.toByteArray(StandardCharsets.UTF_8),
            providedApiKey.toByteArray(StandardCharsets.UTF_8),
        )
    }

    public fun ensureAuthorized(providedApiKey: String?) {
        if (!isValidInternalApiKey(providedApiKey)) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid internal api key")
        }
    }
}
