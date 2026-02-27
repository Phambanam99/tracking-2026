package com.tracking.auth.token

import com.tracking.auth.events.AuthRevocationProducer
import com.tracking.auth.security.JwtService
import com.tracking.auth.security.TokenHashingService
import com.tracking.auth.user.UserEntity
import java.time.Duration
import java.time.Instant
import java.util.UUID
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

@Service
public class RefreshTokenService(
        private val refreshTokenRepository: RefreshTokenRepository,
        private val jwtService: JwtService,
        private val tokenHashingService: TokenHashingService,
        private val authRevocationProducer: AuthRevocationProducer,
        @Value("\${tracking.security.jwt.refresh-token-ttl-seconds:1209600}")
        private val refreshTokenTtlSeconds: Long,
) {
    @Transactional
    public fun issueForUser(user: UserEntity): String {
        val token =
                jwtService.generateRefreshToken(
                        username = user.username,
                        tokenId = UUID.randomUUID().toString(),
                        ttl = Duration.ofSeconds(refreshTokenTtlSeconds),
                )

        val tokenHash = tokenHashingService.hash(token)
        val expiresAt =
                jwtService.extractExpiration(token)
                        ?: throw IllegalStateException("Refresh token must contain expiration")

        val entity =
                RefreshTokenEntity().apply {
                    this.user = user
                    this.tokenHash = tokenHash
                    this.expiresAt = expiresAt
                    this.revoked = false
                }
        refreshTokenRepository.save(entity)

        return token
    }

    @Transactional
    public fun rotate(refreshToken: String): RefreshRotationResult {
        if (!jwtService.isRefreshToken(refreshToken)) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token")
        }
        if (!jwtService.isTokenValid(refreshToken)) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Expired refresh token")
        }

        val presentedHash = tokenHashingService.hash(refreshToken)
        val existingToken =
                refreshTokenRepository.findByTokenHash(presentedHash)
                        ?: throw ResponseStatusException(
                                HttpStatus.UNAUTHORIZED,
                                "Invalid refresh token"
                        )

        if (existingToken.revoked) {
            handleRefreshTokenReuse(existingToken)
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token reuse detected")
        }
        if (existingToken.expiresAt.isBefore(Instant.now())) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Expired refresh token")
        }

        val user = existingToken.user
        val newRefreshToken =
                jwtService.generateRefreshToken(
                        username = user.username,
                        tokenId = UUID.randomUUID().toString(),
                        ttl = Duration.ofSeconds(refreshTokenTtlSeconds),
                )
        val newRefreshTokenHash = tokenHashingService.hash(newRefreshToken)
        val newExpiresAt =
                jwtService.extractExpiration(newRefreshToken)
                        ?: throw IllegalStateException("Refresh token must contain expiration")

        val tokenId =
                existingToken.id ?: throw IllegalStateException("Refresh token id must be present")
        val updatedRows = refreshTokenRepository.markReplacedIfActive(tokenId, newRefreshTokenHash)
        if (updatedRows != 1) {
            handleRefreshTokenReuse(existingToken)
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token reuse detected")
        }

        val replacementToken =
                RefreshTokenEntity().apply {
                    this.user = user
                    this.tokenHash = newRefreshTokenHash
                    this.expiresAt = newExpiresAt
                    this.revoked = false
                }
        refreshTokenRepository.save(replacementToken)

        return RefreshRotationResult(
                user = user,
                newRefreshToken = newRefreshToken,
        )
    }

    @Transactional
    public fun revokeByToken(refreshToken: String) {
        val presentedHash = tokenHashingService.hash(refreshToken)
        val token =
                refreshTokenRepository.findByTokenHash(presentedHash)
                        ?: return // Already gone or never existed

        if (!token.revoked) {
            token.revoked = true
            refreshTokenRepository.save(token)
        }
    }

    private fun handleRefreshTokenReuse(token: RefreshTokenEntity) {
        val userId = token.user.id ?: return
        refreshTokenRepository.revokeAllActiveByUserId(userId)
        authRevocationProducer.publishUserTokensRevoked(
                username = token.user.username,
                reason = "refresh_token_reuse",
        )
    }
}

public data class RefreshRotationResult(
        val user: UserEntity,
        val newRefreshToken: String,
)
