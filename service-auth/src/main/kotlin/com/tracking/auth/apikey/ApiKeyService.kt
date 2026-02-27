package com.tracking.auth.apikey

import com.tracking.auth.api.ApiKeyVerifyResponse
import com.tracking.auth.events.AuthRevocationProducer
import com.tracking.auth.security.TokenHashingService
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.security.SecureRandom
import java.time.Instant
import java.util.Base64

@Service
public class ApiKeyService(
    private val apiKeyRepository: ApiKeyRepository,
    private val tokenHashingService: TokenHashingService,
    private val authRevocationProducer: AuthRevocationProducer,
) {
    @Transactional
    public fun createApiKey(sourceId: String): IssuedApiKey {
        val normalizedSourceId = sourceId.trim()
        if (normalizedSourceId.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "sourceId must not be blank")
        }

        val plaintextApiKey = generateApiKey()
        val keyHash = tokenHashingService.hash(plaintextApiKey)

        val entity = ApiKeyEntity().apply {
            this.keyHash = keyHash
            this.sourceId = normalizedSourceId
            this.active = true
        }

        val saved = apiKeyRepository.save(entity)
        return IssuedApiKey(
            id = saved.id ?: error("Persisted API key must have an id"),
            sourceId = saved.sourceId,
            plaintextApiKey = plaintextApiKey,
            active = saved.active,
        )
    }

    @Transactional(readOnly = true)
    public fun verifyApiKey(apiKey: String): ApiKeyVerifyResponse {
        if (apiKey.isBlank()) {
            return ApiKeyVerifyResponse(valid = false)
        }
        val apiKeyHash = tokenHashingService.hash(apiKey)
        val key = apiKeyRepository.findByKeyHashAndActiveTrue(apiKeyHash)
            ?: return ApiKeyVerifyResponse(valid = false)

        return ApiKeyVerifyResponse(
            valid = true,
            sourceId = key.sourceId,
        )
    }

    @Transactional
    public fun revokeApiKey(id: Long) {
        val apiKey = apiKeyRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "API key not found: $id") }

        if (!apiKey.active) {
            return
        }

        apiKey.active = false
        apiKey.revokedAt = Instant.now()
        apiKeyRepository.save(apiKey)
        authRevocationProducer.publishApiKeyRevoked(id = id, sourceId = apiKey.sourceId)
    }

    private fun generateApiKey(): String {
        val randomBytes = ByteArray(API_KEY_RANDOM_BYTES)
        secureRandom.nextBytes(randomBytes)
        val suffix = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes)
        return API_KEY_PREFIX + suffix
    }

    private companion object {
        private const val API_KEY_PREFIX: String = "trk_live_"
        private const val API_KEY_RANDOM_BYTES: Int = 24
        private val secureRandom: SecureRandom = SecureRandom()
    }
}

public data class IssuedApiKey(
    val id: Long,
    val sourceId: String,
    val plaintextApiKey: String,
    val active: Boolean,
)
