package com.tracking.broadcaster.security

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.databind.ObjectMapper
import java.math.BigInteger
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.security.KeyFactory
import java.security.PublicKey
import java.security.interfaces.RSAPublicKey
import java.security.spec.RSAPublicKeySpec
import java.time.Duration
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import jakarta.annotation.PostConstruct
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

@Component
public class JwksCacheService(
    private val objectMapper: ObjectMapper,
    private val securityProperties: BroadcasterSecurityProperties,
) : JwksKeyProvider {
    private val logger = LoggerFactory.getLogger(JwksCacheService::class.java)
    private val keyFactory: KeyFactory = KeyFactory.getInstance("RSA")
    private val keys: MutableMap<String, PublicKey> = ConcurrentHashMap()
    private val lastRefreshEpochMillis: AtomicLong = AtomicLong(0L)
    private val consecutiveFailures: AtomicInteger = AtomicInteger(0)
    private val httpClient: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofMillis(securityProperties.jwksConnectTimeoutMillis))
        .build()

    override fun resolveCachedKey(kid: String): PublicKey? = keys[kid]

    override fun refreshAndResolveKey(kid: String): PublicKey? {
        refresh()
        return keys[kid]
    }

    @PostConstruct
    public fun warmup(): Unit {
        refresh()
    }

    @Scheduled(fixedDelayString = "\${tracking.broadcaster.security.jwks-refresh-interval-millis:300000}")
    public fun refreshScheduled(): Unit {
        refresh()
    }

    public fun isKidCached(kid: String): Boolean = keys.containsKey(kid)

    public fun refresh(): Boolean {
        val request = HttpRequest.newBuilder()
            .uri(URI.create(securityProperties.jwksUri))
            .timeout(Duration.ofMillis(securityProperties.jwksReadTimeoutMillis))
            .GET()
            .build()

        val response = runCatching {
            httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        }.getOrElse { error ->
            handleRefreshFailure("connect", error)
            return false
        }

        if (response.statusCode() !in 200..299) {
            handleRefreshFailure("http-${response.statusCode()}")
            return false
        }

        val parsedKeys = runCatching { parseJwks(response.body()) }
            .getOrElse { error ->
                handleRefreshFailure("parse", error)
                return false
            }

        val failedAttempts = consecutiveFailures.getAndSet(0)
        if (failedAttempts > 0) {
            logger.info(
                "JWKS cache refresh recovered after {} failed attempt(s); cachedKeys={}",
                failedAttempts,
                parsedKeys.size,
            )
        }
        keys.clear()
        keys.putAll(parsedKeys)
        lastRefreshEpochMillis.set(System.currentTimeMillis())
        return true
    }

    public fun lastRefreshEpochMillis(): Long = lastRefreshEpochMillis.get()

    private fun parseJwks(payload: String): Map<String, PublicKey> {
        val jwks = objectMapper.readValue(payload, JwksDocument::class.java)
        return jwks.keys
            .asSequence()
            .filter { key -> key.kid.isNotBlank() && key.kty == "RSA" }
            .mapNotNull { key -> key.toPublicKeyOrNull() }
            .toMap()
    }

    private fun JwkRecord.toPublicKeyOrNull(): Pair<String, PublicKey>? {
        return runCatching {
            val modulus = BigInteger(1, Base64.getUrlDecoder().decode(n))
            val exponent = BigInteger(1, Base64.getUrlDecoder().decode(e))
            val keySpec = RSAPublicKeySpec(modulus, exponent)
            val publicKey = keyFactory.generatePublic(keySpec) as RSAPublicKey
            kid to publicKey
        }.getOrNull()
    }

    private fun handleRefreshFailure(
        reason: String,
        error: Throwable? = null,
    ): Unit {
        val failureCount = consecutiveFailures.incrementAndGet()
        val cachedKeyCount = keys.size
        val detail = error?.message ?: error?.javaClass?.simpleName

        if (failureCount == 1 || failureCount % 10 == 0 || cachedKeyCount == 0) {
            logger.warn(
                "Failed to refresh JWKS cache: uri={}, reason={}, failures={}, cachedKeys={}, error={}",
                securityProperties.jwksUri,
                reason,
                failureCount,
                cachedKeyCount,
                detail ?: "n/a",
            )
        } else {
            logger.debug(
                "Suppressed JWKS refresh failure: uri={}, reason={}, failures={}, cachedKeys={}",
                securityProperties.jwksUri,
                reason,
                failureCount,
                cachedKeyCount,
            )
        }

        if (error != null && logger.isDebugEnabled) {
            logger.debug("JWKS refresh failure stacktrace", error)
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
