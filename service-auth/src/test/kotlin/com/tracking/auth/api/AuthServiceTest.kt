package com.tracking.auth.api

import com.tracking.auth.security.JwtService
import com.tracking.auth.token.RefreshTokenService
import com.tracking.auth.user.RoleEntity
import com.tracking.auth.user.RoleRepository
import com.tracking.auth.user.UserEntity
import com.tracking.auth.user.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.Mockito.`when`
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.web.server.ResponseStatusException
import java.time.Instant

public class AuthServiceTest {
    private val userRepository: UserRepository = mock(UserRepository::class.java)
    private val roleRepository: RoleRepository = mock(RoleRepository::class.java)
    private val passwordEncoder: PasswordEncoder = mock(PasswordEncoder::class.java)
    private val jwtService: JwtService = mock(JwtService::class.java)
    private val refreshTokenService: RefreshTokenService = mock(RefreshTokenService::class.java)

    private val authService: AuthService = AuthService(
        userRepository = userRepository,
        roleRepository = roleRepository,
        passwordEncoder = passwordEncoder,
        jwtService = jwtService,
        refreshTokenService = refreshTokenService,
    )

    @Test
    public fun `should login successfully and reset lockout counters`() {
        val user = user(username = "alice", passwordHash = "encoded")
        user.failedLoginAttempts = 3
        user.lockedUntil = Instant.now().minusSeconds(30)

        `when`(userRepository.findByUsernameIgnoreCase("alice")).thenReturn(user)
        `when`(passwordEncoder.matches("StrongPass123!", "encoded")).thenReturn(true)
        `when`(jwtService.generateAccessToken("alice", setOf("ROLE_USER"))).thenReturn("access-token")
        `when`(refreshTokenService.issueForUser(user)).thenReturn("refresh-token")
        `when`(userRepository.save(user)).thenReturn(user)

        val response = authService.login(LoginRequest(username = "alice", password = "StrongPass123!"))

        assertEquals("access-token", response.accessToken)
        assertEquals("refresh-token", response.refreshToken)
        assertEquals(0, user.failedLoginAttempts)
        assertNull(user.lockedUntil)
        assertNotNull(user.lastLoginAt)
        verify(userRepository, times(2)).save(user)
    }

    @Test
    public fun `should lock account after threshold failed attempts`() {
        val user = user(username = "alice", passwordHash = "encoded")
        user.failedLoginAttempts = 4
        user.lockedUntil = null

        `when`(userRepository.findByUsernameIgnoreCase("alice")).thenReturn(user)
        `when`(passwordEncoder.matches("wrong-password", "encoded")).thenReturn(false)
        `when`(userRepository.save(user)).thenReturn(user)

        val exception = assertThrows<ResponseStatusException> {
            authService.login(LoginRequest(username = "alice", password = "wrong-password"))
        }

        assertEquals(HttpStatus.UNAUTHORIZED, exception.statusCode)
        assertEquals(5, user.failedLoginAttempts)
        assertTrue(user.lockedUntil?.isAfter(Instant.now()) == true)
        verify(userRepository, times(1)).save(user)
    }

    @Test
    public fun `should reject locked user before password check`() {
        val user = user(username = "alice", passwordHash = "encoded")
        user.lockedUntil = Instant.now().plusSeconds(300)

        `when`(userRepository.findByUsernameIgnoreCase("alice")).thenReturn(user)

        val exception = assertThrows<ResponseStatusException> {
            authService.login(LoginRequest(username = "alice", password = "StrongPass123!"))
        }

        assertEquals(HttpStatus.FORBIDDEN, exception.statusCode)
        verifyNoInteractions(passwordEncoder)
    }

    @Test
    public fun `should revoke refresh token on logout`() {
        authService.logout(LogoutRequest(refreshToken = "refresh-token"))

        verify(refreshTokenService, times(1)).revokeByToken("refresh-token")
    }

    private fun user(
        username: String,
        passwordHash: String,
    ): UserEntity {
        val roleUser = RoleEntity().apply { name = "ROLE_USER" }
        return UserEntity().apply {
            this.username = username
            this.email = "$username@example.com"
            this.passwordHash = passwordHash
            this.enabled = true
            this.roles = mutableSetOf(roleUser)
        }
    }
}
