package com.tracking.gateway.security

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.gateway.config.GatewayResilienceProperties
import java.math.BigInteger
import java.security.KeyFactory
import java.security.PublicKey
import java.security.interfaces.RSAPublicKey
import java.security.spec.RSAPublicKeySpec
import java.time.Duration
import java.time.Instant
import java.util.Base64
import java.util.concurrent.atomic.AtomicReference
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.cloud.client.circuitbreaker.ReactiveCircuitBreaker
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import reactor.core.publisher.Mono

@Component
public class JwksCacheService(
    @Qualifier("authWebClient")
    private val authWebClient: WebClient,
    @Qualifier("jwksCircuitBreaker")
    private val circuitBreaker: ReactiveCircuitBreaker,
    private val objectMapper: ObjectMapper,
    private val securityProperties: GatewaySecurityProperties,
    private val resilienceProperties: GatewayResilienceProperties,
) {
    private val keyFactory: KeyFactory = KeyFactory.getInstance("RSA")
    private val cacheRef: AtomicReference<CachedJwks> = AtomicReference(CachedJwks.empty())
    private val inFlightRefresh: AtomicReference<Mono<CachedJwks>?> = AtomicReference(null)

    public fun resolveKey(kid: String): Mono<PublicKey?> {
        val now = Instant.now()
        val current = cacheRef.get()
        if (current.isFresh(now)) {
            current.keys[kid]?.let { key -> return Mono.just(key) }
        }

        return refresh().map { refreshed -> refreshed.keys[kid] }
    }

    public fun refresh(): Mono<CachedJwks> {
        val existingRefresh = inFlightRefresh.get()
        if (existingRefresh != null) {
            return existingRefresh
        }

        val refreshMono = fetchRemoteJwks()
            .map { keys ->
                val refreshed = CachedJwks(
                    keys = keys,
                    expiresAt = Instant.now().plusSeconds(securityProperties.jwksRefreshIntervalSeconds),
                )
                cacheRef.set(refreshed)
                refreshed
            }
            .doFinally { inFlightRefresh.set(null) }
            .cache()

        return if (inFlightRefresh.compareAndSet(null, refreshMono)) {
            refreshMono
        } else {
            inFlightRefresh.get() ?: refreshMono
        }
    }

    public fun isKidCached(kid: String): Boolean = cacheRef.get().keys.containsKey(kid)

    private fun fetchRemoteJwks(): Mono<Map<String, RSAPublicKey>> {
        val request = authWebClient.get()
            .uri(securityProperties.jwksUri)
            .retrieve()
            .bodyToMono(String::class.java)
            .map { payload -> parseJwks(payload) }
            .timeout(Duration.ofMillis(resilienceProperties.jwksCallTimeoutMillis))

        return circuitBreaker.run(
            request,
        ) { error ->
            Mono.error(JwksUnavailableException("Failed to refresh JWKS from auth-service.", error))
        }
    }

    private fun parseJwks(payload: String): Map<String, RSAPublicKey> {
        val jwks = objectMapper.readValue(payload, JwksDocument::class.java)
        return jwks.keys
            .asSequence()
            .filter { key -> key.kid.isNotBlank() && key.kty == "RSA" }
            .mapNotNull { key -> key.toPublicKeyOrNull() }
            .toMap()
    }

    private fun JwkRecord.toPublicKeyOrNull(): Pair<String, RSAPublicKey>? {
        return runCatching {
            val modulus = BigInteger(1, Base64.getUrlDecoder().decode(n))
            val exponent = BigInteger(1, Base64.getUrlDecoder().decode(e))
            val keySpec = RSAPublicKeySpec(modulus, exponent)
            val publicKey = keyFactory.generatePublic(keySpec) as RSAPublicKey
            kid to publicKey
        }.getOrNull()
    }

    public data class CachedJwks(
        val keys: Map<String, RSAPublicKey>,
        val expiresAt: Instant,
    ) {
        public fun isFresh(now: Instant): Boolean = now.isBefore(expiresAt)

        public companion object {
            public fun empty(): CachedJwks = CachedJwks(
                keys = emptyMap(),
                expiresAt = Instant.EPOCH,
            )
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class JwksDocument(
        val keys: List<JwkRecord> = emptyList(),
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class JwkRecord(
        val kid: String = "",
        val kty: String = "",
        val n: String = "",
        val e: String = "",
    )
}

public class JwksUnavailableException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

@ConfigurationProperties(prefix = "tracking.gateway.security")
public class GatewaySecurityProperties(
    public var failClosed: Boolean = true,
    public var jwtIssuer: String = "tracking-auth",
    public var jwksUri: String = "http://service-auth:8081/api/v1/auth/.well-known/jwks.json",
    public var apiKeyVerifyUri: String = "http://service-auth:8081/internal/v1/api-keys/verify",
    public var internalApiKey: String = "",
    public var apiKeyCacheTtlSeconds: Long = 60,
    public var accessTokenTtlSeconds: Long = 900,
    public var revocationUserTtlSeconds: Long = 900,
    public var revocationApiKeyTtlSeconds: Long = 900,
    public var jwksRefreshIntervalSeconds: Long = 300,
)
