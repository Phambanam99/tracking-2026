package com.tracking.gateway.security

import com.fasterxml.jackson.databind.ObjectMapper
import io.jsonwebtoken.Claims
import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts
import java.nio.charset.StandardCharsets
import java.security.PublicKey
import java.time.Instant
import java.util.Base64
import org.springframework.stereotype.Component
import reactor.core.publisher.Mono

@Component
public class JwtTokenVerifier(
    private val jwksCacheService: JwksCacheService,
    private val objectMapper: ObjectMapper,
    private val securityProperties: GatewaySecurityProperties,
) : TokenVerifier {
    override fun verify(token: String): Mono<TokenPrincipal> {
        val kid = extractKid(token) ?: return Mono.empty()

        return jwksCacheService.resolveKey(kid)
            .flatMap { publicKey ->
                if (publicKey == null) {
                    return@flatMap Mono.empty<TokenPrincipal>()
                }

                Mono.defer {
                    val principal = toPrincipal(token, publicKey)
                    if (principal == null) {
                        Mono.empty()
                    } else {
                        Mono.just(principal)
                    }
                }
            }
            .onErrorResume { Mono.empty() }
    }

    private fun toPrincipal(token: String, publicKey: PublicKey): TokenPrincipal? {
        return try {
            val claims = Jwts.parser()
                .requireIssuer(securityProperties.jwtIssuer)
                .verifyWith(publicKey)
                .build()
                .parseSignedClaims(token)
                .payload

            if (claims[CLAIM_TOKEN_TYPE] == TOKEN_TYPE_REFRESH) {
                return null
            }

            val subject = claims.subject?.takeIf { it.isNotBlank() } ?: return null
            val tokenId = claims.id?.takeIf { it.isNotBlank() } ?: return null
            val expiration = claims.expiration?.toInstant() ?: return null
            if (expiration.isBefore(Instant.now())) {
                return null
            }

            return TokenPrincipal(
                subject = subject,
                roles = claims.extractRoles(),
                tokenId = tokenId,
                expiresAt = expiration,
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
