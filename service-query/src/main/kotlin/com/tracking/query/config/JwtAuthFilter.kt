package com.tracking.query.config

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.github.benmanes.caffeine.cache.Caffeine
import io.jsonwebtoken.Claims
import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import java.math.BigInteger
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.security.KeyFactory
import java.security.PublicKey
import java.security.spec.RSAPublicKeySpec
import java.time.Duration
import java.util.Base64
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

/**
 * Stateless JWT authentication filter.
 *
 * On each request:
 * 1. Extract Bearer token from Authorization header.
 * 2. Parse JWT header -> `kid` -> look up public key in Caffeine cache.
 * 3. On cache miss: refetch JWKS from service-auth (rate-limited).
 * 4. Verify signature + expiry; populate SecurityContext with [UsernamePasswordAuthenticationToken].
 *
 * Query endpoints are `permitAll`, so JWT failures must never turn a request into 500.
 */
@Component
public class JwtAuthFilter(
    @Value("\${tracking.security.jwks-uri:http://service-auth:8081/api/v1/auth/.well-known/jwks.json}")
    private val jwksUri: String,
    @Value("\${tracking.security.jwks-cache-ttl-seconds:300}")
    private val jwksCacheTtlSeconds: Long,
) : OncePerRequestFilter() {

    private val log = LoggerFactory.getLogger(javaClass)
    private val objectMapper = jacksonObjectMapper()
    private val httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build()

    private val keyCache = Caffeine.newBuilder()
        .expireAfterWrite(Duration.ofSeconds(jwksCacheTtlSeconds))
        .maximumSize(10)
        .build<String, PublicKey>()

    @Volatile
    private var lastJwksFetchAt = 0L

    private val jwksFetchRateLimitMs = 10_000L

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        chain: FilterChain,
    ) {
        val token = extractBearerToken(request)
        if (token != null) {
            try {
                val claims = verifyToken(token)
                if (claims != null) {
                    val username = claims.subject
                    val userId = claims["uid"]?.toString()?.toLongOrNull()
                    @Suppress("UNCHECKED_CAST")
                    val roles = (claims["roles"] as? List<String>) ?: emptyList()
                    val authorities = roles.map { SimpleGrantedAuthority(it) }

                    val principal = mapOf("username" to username, "userId" to userId, "roles" to roles)
                    val auth = UsernamePasswordAuthenticationToken(principal, null, authorities)
                    SecurityContextHolder.getContext().authentication = auth
                }
            } catch (ex: JwtException) {
                log.debug("JWT verification failed: {}", ex.message)
            } catch (ex: RuntimeException) {
                log.debug("JWT authentication skipped: {}", ex.message)
            }
        }

        chain.doFilter(request, response)
    }

    private fun verifyToken(token: String): Claims? {
        val kid = extractKid(token) ?: "default"
        val publicKey = keyCache.get(kid) { loadKeyForKid(it) } ?: return null

        return Jwts.parser()
            .verifyWith(publicKey)
            .build()
            .parseSignedClaims(token)
            .payload
    }

    private fun extractKid(token: String): String? {
        return try {
            val headerB64 = token.substringBefore(".")
            val headerJson = String(Base64.getUrlDecoder().decode(headerB64))
            @Suppress("UNCHECKED_CAST")
            val header = objectMapper.readValue<Map<String, Any>>(headerJson)
            header["kid"] as? String
        } catch (_: Exception) {
            null
        }
    }

    private fun loadKeyForKid(kid: String): PublicKey? {
        val keys = fetchJwks() ?: return null
        return keys[kid]
    }

    private fun fetchJwks(): Map<String, PublicKey>? {
        val now = System.currentTimeMillis()
        if (now - lastJwksFetchAt < jwksFetchRateLimitMs) {
            log.debug("JWKS refetch rate-limited, using cache")
            return null
        }

        return try {
            lastJwksFetchAt = now
            val request = HttpRequest.newBuilder(URI.create(jwksUri))
                .GET()
                .timeout(Duration.ofSeconds(3))
                .build()
            val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() != 200) {
                log.warn("JWKS endpoint returned {}", response.statusCode())
                return null
            }

            val jsonNode = objectMapper.readTree(response.body())
            val result = mutableMapOf<String, PublicKey>()
            jsonNode["keys"]?.forEach { jwk ->
                val kidVal = jwk["kid"]?.asText() ?: "default"
                val pubKey = parseRsaPublicKey(jwk) ?: return@forEach
                result[kidVal] = pubKey
                keyCache.put(kidVal, pubKey)
            }
            result
        } catch (ex: Exception) {
            log.error("Failed to fetch JWKS from {}: {}", jwksUri, ex.message)
            null
        }
    }

    private fun parseRsaPublicKey(jwk: com.fasterxml.jackson.databind.JsonNode): PublicKey? {
        return try {
            val n = Base64.getUrlDecoder().decode(jwk["n"].asText())
            val e = Base64.getUrlDecoder().decode(jwk["e"].asText())
            val spec = RSAPublicKeySpec(BigInteger(1, n), BigInteger(1, e))
            KeyFactory.getInstance("RSA").generatePublic(spec)
        } catch (ex: Exception) {
            log.warn("Failed to parse RSA public key from JWKS: {}", ex.message)
            null
        }
    }

    private fun extractBearerToken(request: HttpServletRequest): String? {
        val header = request.getHeader("Authorization") ?: return null
        return if (header.startsWith("Bearer ")) {
            header.removePrefix("Bearer ")
        } else {
            null
        }
    }
}
