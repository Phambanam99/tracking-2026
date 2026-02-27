package com.tracking.auth.security

import io.jsonwebtoken.Claims
import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts
import org.springframework.beans.factory.ObjectProvider
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.time.Instant
import java.util.Base64
import java.util.Date
import java.util.UUID
import com.fasterxml.jackson.databind.ObjectMapper

@Component
public class JwtService(
    private val jwksKeyProvider: JwksKeyProvider,
    objectMapperProvider: ObjectProvider<ObjectMapper>? = null,
    @Value("\${tracking.security.jwt.issuer:tracking-auth}")
    private val issuer: String = "tracking-auth",
    @Value("\${tracking.security.jwt.access-token-ttl-seconds:900}")
    private val accessTokenTtlSeconds: Long = 900,
    @Value("\${tracking.security.jwt.refresh-token-ttl-seconds:1209600}")
    private val refreshTokenTtlSeconds: Long = 1209600,
) {
    private val objectMapper: ObjectMapper = objectMapperProvider?.ifAvailable ?: ObjectMapper()

    public fun generateAccessToken(
        username: String,
        roles: Set<String>,
        ttl: Duration = Duration.ofSeconds(accessTokenTtlSeconds),
    ): String {
        val now = Instant.now()

        return Jwts.builder()
            .header().keyId(jwksKeyProvider.activeKid()).and()
            .subject(username)
            .issuer(issuer)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(ttl)))
            .claim(CLAIM_ROLES, roles.toList())
            .id(UUID.randomUUID().toString())
            .signWith(jwksKeyProvider.activePrivateKey(), Jwts.SIG.RS256)
            .compact()
    }

    public fun generateRefreshToken(
        username: String,
        tokenId: String,
        ttl: Duration = Duration.ofSeconds(refreshTokenTtlSeconds),
    ): String {
        val now = Instant.now()

        return Jwts.builder()
            .header().keyId(jwksKeyProvider.activeKid()).and()
            .subject(username)
            .issuer(issuer)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(ttl)))
            .id(tokenId)
            .claim(CLAIM_TOKEN_TYPE, TOKEN_TYPE_REFRESH)
            .signWith(jwksKeyProvider.activePrivateKey(), Jwts.SIG.RS256)
            .compact()
    }

    public fun extractUsername(token: String): String? = parseClaims(token)?.subject

    public fun extractTokenId(token: String): String? = parseClaims(token)?.id

    public fun extractRoles(token: String): Set<String> {
        val claims = parseClaims(token) ?: return emptySet()
        val roles = claims[CLAIM_ROLES] as? List<*> ?: return emptySet()

        return roles.filterIsInstance<String>().toSet()
    }

    public fun extractExpiration(token: String): Instant? {
        val claims = parseClaims(token) ?: return null
        return claims.expiration?.toInstant()
    }

    public fun isRefreshToken(token: String): Boolean {
        val claims = parseClaims(token) ?: return false
        return claims[CLAIM_TOKEN_TYPE] == TOKEN_TYPE_REFRESH
    }

    public fun isTokenValid(token: String, expectedUsername: String? = null): Boolean {
        val claims = parseClaims(token) ?: return false
        if (claims.expiration.before(Date.from(Instant.now()))) {
            return false
        }

        return expectedUsername == null || claims.subject == expectedUsername
    }

    public fun extractBearerToken(header: String?): String? {
        if (header == null) {
            return null
        }

        if (!header.startsWith(BEARER_PREFIX)) {
            return null
        }

        return header.removePrefix(BEARER_PREFIX).trim().takeIf { it.isNotEmpty() }
    }

    private fun parseClaims(token: String): Claims? {
        val kid = extractKid(token)
        if (kid != null) {
            val keyByKid = jwksKeyProvider.findPublicKeyByKid(kid) ?: return null
            return parseClaimsWithKey(token, keyByKid)
        }

        for ((_, publicKey) in jwksKeyProvider.publicKeys()) {
            val claims = parseClaimsWithKey(token, publicKey)
            if (claims != null) {
                return claims
            }
        }

        return null
    }

    private fun parseClaimsWithKey(token: String, publicKey: java.security.PublicKey): Claims? {
        return try {
            Jwts.parser()
                .requireIssuer(issuer)
                .verifyWith(publicKey)
                .build()
                .parseSignedClaims(token)
                .payload
        } catch (_: JwtException) {
            null
        } catch (_: IllegalArgumentException) {
            null
        }
    }

    private fun extractKid(token: String): String? {
        val headerSegment = token.substringBefore('.', missingDelimiterValue = "")
        if (headerSegment.isBlank()) {
            return null
        }

        return try {
            val headerJson = String(Base64.getUrlDecoder().decode(headerSegment), StandardCharsets.UTF_8)
            val rootNode = objectMapper.readTree(headerJson)
            rootNode.path("kid").asText(null)?.takeIf { it.isNotBlank() }
        } catch (_: IllegalArgumentException) {
            null
        } catch (_: com.fasterxml.jackson.core.JsonProcessingException) {
            null
        }
    }

    private companion object {
        private const val CLAIM_ROLES: String = "roles"
        private const val CLAIM_TOKEN_TYPE: String = "token_type"
        private const val TOKEN_TYPE_REFRESH: String = "refresh"
        private const val BEARER_PREFIX: String = "Bearer "
    }
}
