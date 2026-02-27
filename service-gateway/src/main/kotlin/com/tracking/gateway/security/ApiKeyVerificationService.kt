package com.tracking.gateway.security

import com.tracking.gateway.config.GatewayResilienceProperties
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import java.util.HexFormat
import java.util.concurrent.ConcurrentHashMap
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.cloud.client.circuitbreaker.ReactiveCircuitBreaker
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import reactor.core.publisher.Mono

public data class ApiKeyPrincipal(
    val sourceId: String,
)

public interface ApiKeyVerifier {
    public fun verify(apiKey: String): Mono<ApiKeyPrincipal>
}

@Component
public class ApiKeyVerificationService(
    @Qualifier("authWebClient")
    private val authWebClient: WebClient,
    @Qualifier("apiKeyCircuitBreaker")
    private val circuitBreaker: ReactiveCircuitBreaker,
    private val securityProperties: GatewaySecurityProperties,
    private val resilienceProperties: GatewayResilienceProperties,
) : ApiKeyVerifier {
    private val cache: MutableMap<String, CachedApiKeyVerification> = ConcurrentHashMap()

    override fun verify(apiKey: String): Mono<ApiKeyPrincipal> {
        val fingerprint = fingerprintApiKey(apiKey)
        val now = Instant.now()
        val fromCache = cache[fingerprint]
        if (fromCache != null && fromCache.expiresAt.isAfter(now)) {
            return Mono.just(fromCache.principal)
        }

        val call = authWebClient.post()
            .uri(securityProperties.apiKeyVerifyUri)
            .header(INTERNAL_API_KEY_HEADER, securityProperties.internalApiKey)
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(ApiKeyVerifyRequest(apiKey = apiKey))
            .retrieve()
            .bodyToMono(ApiKeyVerifyResponse::class.java)
            .timeout(Duration.ofMillis(resilienceProperties.apiKeyCallTimeoutMillis))
            .flatMap { response ->
                if (!response.valid || response.sourceId.isNullOrBlank()) {
                    Mono.empty()
                } else {
                    Mono.just(ApiKeyPrincipal(sourceId = response.sourceId))
                }
            }

        return circuitBreaker.run(call) { Mono.empty() }
            .map { principal ->
                cache[fingerprint] = CachedApiKeyVerification(
                    principal = principal,
                    expiresAt = Instant.now().plusSeconds(securityProperties.apiKeyCacheTtlSeconds),
                )
                principal
            }
            .onErrorResume { Mono.empty() }
    }

    private data class CachedApiKeyVerification(
        val principal: ApiKeyPrincipal,
        val expiresAt: Instant,
    )

    private data class ApiKeyVerifyRequest(
        val apiKey: String,
    )

    private data class ApiKeyVerifyResponse(
        val valid: Boolean = false,
        val sourceId: String? = null,
    )

    private fun fingerprintApiKey(apiKey: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(apiKey.toByteArray(StandardCharsets.UTF_8))
        return HexFormat.of().formatHex(digest)
    }

    private companion object {
        private const val INTERNAL_API_KEY_HEADER: String = "x-internal-api-key"
    }
}
