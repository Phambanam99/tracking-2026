package com.tracking.auth.api

import com.tracking.auth.security.JwtService
import com.tracking.auth.token.RefreshTokenService
import com.tracking.auth.user.RoleEntity
import com.tracking.auth.user.RoleRepository
import com.tracking.auth.user.UserEntity
import com.tracking.auth.user.UserRepository
import java.time.Duration
import java.time.Instant
import org.slf4j.LoggerFactory
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

@Service
public class AuthService(
        private val userRepository: UserRepository,
        private val roleRepository: RoleRepository,
        private val passwordEncoder: PasswordEncoder,
        private val jwtService: JwtService,
        private val refreshTokenService: RefreshTokenService,
) {
    private val log = LoggerFactory.getLogger(AuthService::class.java)

    @Transactional
    public fun register(request: RegisterRequest): AuthTokensResponse {
        val username = request.username.trim()
        val email = request.email.trim().lowercase()

        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Username already exists")
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Email already exists")
        }

        val defaultRole = findOrCreateDefaultUserRole()
        val savedUser =
                try {
                    userRepository.save(
                            UserEntity().apply {
                                this.username = username
                                this.email = email
                                this.passwordHash = passwordEncoder.encode(request.password)
                                this.enabled = true
                                this.roles = mutableSetOf(defaultRole)
                            },
                    )
                } catch (e: DataIntegrityViolationException) {
                    log.warn(
                            "Registration failed due to existing user: username={} or email={}",
                            username,
                            email
                    )
                    throw ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Username or email already exists"
                    )
                }

        log.info("User registered successfully: username={}, email={}", username, email)
        return issueTokens(savedUser)
    }

    @Transactional
    public fun login(request: LoginRequest): AuthTokensResponse {
        val normalizedUsername = request.username.trim()
        val user =
                userRepository.findByUsernameIgnoreCase(normalizedUsername)
                        ?: run {
                            log.warn("Login failed: User not found: {}", normalizedUsername)
                            throw ResponseStatusException(
                                    HttpStatus.UNAUTHORIZED,
                                    "Invalid credentials"
                            )
                        }

        if (!user.enabled) {
            log.warn("Login failed: User is disabled: {}", normalizedUsername)
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "User is disabled")
        }

        if (user.isLockedOut()) {
            log.warn(
                    "Login failed: User is locked out: {}. Locked until {}",
                    normalizedUsername,
                    user.lockedUntil
            )
            throw ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Account is locked. Try again later."
            )
        }

        if (!passwordEncoder.matches(request.password, user.passwordHash)) {
            handleFailedLogin(user)
            log.warn("Login failed: Invalid password for user: {}", normalizedUsername)
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials")
        }

        resetFailedLogin(user)
        user.lastLoginAt = Instant.now()
        userRepository.save(user)

        log.info("User login successful: {}", normalizedUsername)
        return issueTokens(user)
    }

    @Transactional
    public fun logout(request: LogoutRequest) {
        val refreshToken = request.refreshToken
        log.info("User logout initiated")
        refreshTokenService.revokeByToken(refreshToken)
    }

    @Transactional
    public fun refresh(request: RefreshTokenRequest): AuthTokensResponse {
        val rotationResult = refreshTokenService.rotate(request.refreshToken)
        val user = rotationResult.user
        if (!user.enabled) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "User is disabled")
        }

        val accessToken =
                jwtService.generateAccessToken(
                        username = user.username,
                        roles = user.roleNames(),
                )

        return AuthTokensResponse(
                accessToken = accessToken,
                refreshToken = rotationResult.newRefreshToken,
        )
    }

    @Transactional(readOnly = true)
    public fun verifyToken(request: TokenVerifyRequest): TokenVerifyResponse {
        val username =
                jwtService.extractUsername(request.token)
                        ?: return TokenVerifyResponse(valid = false)
        if (!jwtService.isTokenValid(request.token, username)) {
            return TokenVerifyResponse(valid = false)
        }
        if (jwtService.isRefreshToken(request.token)) {
            return TokenVerifyResponse(valid = false)
        }

        return TokenVerifyResponse(
                valid = true,
                username = username,
                roles = jwtService.extractRoles(request.token),
        )
    }

    private fun issueTokens(user: UserEntity): AuthTokensResponse {
        val accessToken =
                jwtService.generateAccessToken(
                        username = user.username,
                        roles = user.roleNames(),
                )
        val refreshToken = refreshTokenService.issueForUser(user)
        return AuthTokensResponse(
                accessToken = accessToken,
                refreshToken = refreshToken,
        )
    }

    private fun findOrCreateDefaultUserRole(): RoleEntity {
        return roleRepository.findByName(DEFAULT_USER_ROLE)
                ?: roleRepository.save(
                        RoleEntity().apply { name = DEFAULT_USER_ROLE },
                )
    }

    private fun handleFailedLogin(user: UserEntity) {
        user.failedLoginAttempts += 1
        if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
            user.lockedUntil = Instant.now().plus(Duration.ofMinutes(LOCKOUT_DURATION_MINUTES))
            log.error(
                    "Account locked due to repetitive failed attempts: username={}",
                    user.username
            )
        }
        userRepository.save(user)
    }

    private fun resetFailedLogin(user: UserEntity) {
        user.failedLoginAttempts = 0
        user.lockedUntil = null
        userRepository.save(user)
    }

    private companion object {
        private const val DEFAULT_USER_ROLE: String = "ROLE_USER"
        private const val MAX_FAILED_ATTEMPTS: Int = 5
        private const val LOCKOUT_DURATION_MINUTES: Long = 15
    }
}
