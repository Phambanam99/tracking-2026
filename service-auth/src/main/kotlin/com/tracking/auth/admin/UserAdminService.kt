package com.tracking.auth.admin

import com.tracking.auth.user.UserEntity
import com.tracking.auth.user.UserRepository
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

@Service
public class UserAdminService(
    private val userRepository: UserRepository,
) {
    @Transactional(readOnly = true)
    public fun listUsers(page: Int, size: Int): UserAdminListResponse {
        val safePage = page.coerceAtLeast(0)
        val safeSize = size.coerceIn(1, MAX_PAGE_SIZE)
        val pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Order.asc("id")))
        val usersPage = userRepository.findAll(pageable)

        return UserAdminListResponse(
            content = usersPage.content.map { user -> toView(user) },
            page = usersPage.number,
            size = usersPage.size,
            totalElements = usersPage.totalElements,
            totalPages = usersPage.totalPages,
        )
    }

    @Transactional
    public fun disableUser(id: Long, performedBy: String): Unit = updateEnabledStatus(
        id = id,
        enabled = false,
        performedBy = performedBy,
    )

    @Transactional
    public fun enableUser(id: Long, performedBy: String): Unit = updateEnabledStatus(
        id = id,
        enabled = true,
        performedBy = performedBy,
    )

    private fun updateEnabledStatus(id: Long, enabled: Boolean, performedBy: String) {
        val user = userRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: $id") }

        if (user.enabled == enabled) {
            return
        }

        val previous = user.enabled
        user.enabled = enabled
        userRepository.save(user)

        logger.info(
            "user-admin action={} targetUserId={} targetUsername={} previousEnabled={} newEnabled={} performedBy={}",
            if (enabled) "ENABLE" else "DISABLE",
            id,
            user.username,
            previous,
            enabled,
            performedBy,
        )
    }

    private fun toView(user: UserEntity): UserAdminView {
        return UserAdminView(
            id = user.id ?: error("Persisted user must have id"),
            username = user.username,
            email = user.email,
            enabled = user.enabled,
            roles = user.roleNames().toList().sorted(),
            createdAt = user.createdAt.toString(),
        )
    }

    private companion object {
        private const val MAX_PAGE_SIZE: Int = 200
        private val logger = LoggerFactory.getLogger(UserAdminService::class.java)
    }
}

public data class UserAdminListResponse(
    val content: List<UserAdminView>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

public data class UserAdminView(
    val id: Long,
    val username: String,
    val email: String,
    val enabled: Boolean,
    val roles: List<String>,
    val createdAt: String,
)
