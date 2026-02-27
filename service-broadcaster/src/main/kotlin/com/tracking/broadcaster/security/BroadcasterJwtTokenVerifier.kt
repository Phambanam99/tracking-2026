package com.tracking.broadcaster.security

import com.fasterxml.jackson.databind.ObjectMapper
import io.jsonwebtoken.Claims
import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts
import java.nio.charset.StandardCharsets
import java.security.PublicKey
import java.time.Instant
import java.util.Base64
import org.springframework.stereotype.Component

@Component
public class BroadcasterJwtTokenVerifier(
    private val jwksKeyProvider: JwksKeyProvider,
    private val objectMapper: ObjectMapper,
    private val securityProperties: BroadcasterSecurityProperties,
) {
    public fun verify(token: String): BroadcasterTokenPrincipal? {
        val kid = extractKid(token) ?: return null
        val key = jwksKeyProvider.resolveCachedKey(kid)
            ?: jwksKeyProvider.refreshAndResolveKey(kid)
            ?: return null
        return toPrincipal(token, key)
    }

    private fun toPrincipal(token: String, key: PublicKey): BroadcasterTokenPrincipal? {
        return try {
            val claims = Jwts.parser()
                .requireIssuer(securityProperties.jwtIssuer)
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .payload

            if (claims[CLAIM_TOKEN_TYPE] == TOKEN_TYPE_REFRESH) {
                return null
            }

            val subject = claims.subject?.takeIf { it.isNotBlank() } ?: return null
            val tokenId = claims.id?.takeIf { it.isNotBlank() } ?: return null
            val expiresAt = claims.expiration?.toInstant() ?: return null
            if (expiresAt.isBefore(Instant.now())) {
                return null
            }

            BroadcasterTokenPrincipal(
                subject = subject,
                tokenId = tokenId,
                roles = claims.extractRoles(),
                expiresAt = expiresAt,
            )
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

        return runCatching {
            val headerJson = String(Base64.getUrlDecoder().decode(headerSegment), StandardCharsets.UTF_8)
            val root = objectMapper.readTree(headerJson)
            root.path("kid").asText(null)?.takeIf { it.isNotBlank() }
        }.getOrNull()
    }

    private fun Claims.extractRoles(): Set<String> {
        val value = this[CLAIM_ROLES] as? List<*> ?: return emptySet()
        return value.filterIsInstance<String>().toSet()
    }

    private companion object {
        private const val CLAIM_ROLES: String = "roles"
        private const val CLAIM_TOKEN_TYPE: String = "token_type"
        private const val TOKEN_TYPE_REFRESH: String = "refresh"
    }
}
