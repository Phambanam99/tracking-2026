package com.tracking.auth.admin

import com.tracking.auth.user.RoleEntity
import com.tracking.auth.user.UserEntity
import com.tracking.auth.user.UserRepository
import java.time.Instant
import java.util.Optional
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.Mockito.`when`
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.Mockito.any
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException

public class UserAdminServiceTest {
    private val userRepository: UserRepository = mock(UserRepository::class.java)
    private val userAdminService: UserAdminService = UserAdminService(userRepository)

    @Test
    public fun `should list users with pagination`() {
        val alice = user(id = 1L, username = "alice", enabled = true, roles = setOf("ROLE_USER"))
        val admin = user(id = 2L, username = "admin", enabled = true, roles = setOf("ROLE_ADMIN", "ROLE_USER"))
        val pageRequest = PageRequest.of(0, 20, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Order.asc("id")))
        `when`(userRepository.findAll(any(PageRequest::class.java)))
            .thenReturn(PageImpl(listOf(alice, admin), pageRequest, 2))

        val response = userAdminService.listUsers(page = 0, size = 20)

        assertEquals(2, response.content.size)
        assertEquals("alice", response.content[0].username)
        assertEquals(listOf("ROLE_USER"), response.content[0].roles)
        assertEquals("admin", response.content[1].username)
        assertEquals(listOf("ROLE_ADMIN", "ROLE_USER"), response.content[1].roles)
        assertEquals(2, response.totalElements)
    }

    @Test
    public fun `should disable enabled user`() {
        val pilot = user(id = 10L, username = "pilot", enabled = true, roles = setOf("ROLE_USER"))
        `when`(userRepository.findById(10L)).thenReturn(Optional.of(pilot))
        `when`(userRepository.save(pilot)).thenReturn(pilot)

        userAdminService.disableUser(id = 10L, performedBy = "admin")

        assertFalse(pilot.enabled)
        verify(userRepository, times(1)).save(pilot)
    }

    @Test
    public fun `should enable disabled user`() {
        val pilot = user(id = 11L, username = "pilot", enabled = false, roles = setOf("ROLE_USER"))
        `when`(userRepository.findById(11L)).thenReturn(Optional.of(pilot))
        `when`(userRepository.save(pilot)).thenReturn(pilot)

        userAdminService.enableUser(id = 11L, performedBy = "admin")

        assertTrue(pilot.enabled)
        verify(userRepository, times(1)).save(pilot)
    }

    @Test
    public fun `should return not found when user does not exist`() {
        `when`(userRepository.findById(999L)).thenReturn(Optional.empty())

        val exception = assertThrows<ResponseStatusException> {
            userAdminService.disableUser(id = 999L, performedBy = "admin")
        }

        assertEquals(HttpStatus.NOT_FOUND, exception.statusCode)
    }

    private fun user(
        id: Long,
        username: String,
        enabled: Boolean,
        roles: Set<String>,
    ): UserEntity {
        val entities = roles.map { roleName ->
            RoleEntity().apply { name = roleName }
        }.toMutableSet()

        return UserEntity().apply {
            this.id = id
            this.username = username
            this.email = "$username@example.com"
            this.passwordHash = "encoded"
            this.enabled = enabled
            this.roles = entities
            this.createdAt = Instant.parse("2026-01-01T00:00:00Z")
        }
    }
}
