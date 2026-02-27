package com.tracking.auth.user

import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
public class AdminBootstrapInitializer(
    private val userRepository: UserRepository,
    private val roleRepository: RoleRepository,
    private val passwordEncoder: PasswordEncoder,
    @Value("\${auth.bootstrap-admin.enabled:false}")
    private val enabled: Boolean,
    @Value("\${auth.bootstrap-admin.username:}")
    private val username: String,
    @Value("\${auth.bootstrap-admin.email:}")
    private val email: String,
    @Value("\${auth.bootstrap-admin.password:}")
    private val password: String,
) : ApplicationRunner {
    @Transactional
    override fun run(args: ApplicationArguments) {
        if (!enabled) {
            return
        }

        val normalizedUsername = username.trim()
        val normalizedEmail = email.trim().lowercase()
        require(normalizedUsername.isNotBlank()) { "auth.bootstrap-admin.username must not be blank when enabled" }
        require(normalizedEmail.isNotBlank()) { "auth.bootstrap-admin.email must not be blank when enabled" }
        require(password.length >= MIN_BOOTSTRAP_PASSWORD_LENGTH) {
            "auth.bootstrap-admin.password must be at least $MIN_BOOTSTRAP_PASSWORD_LENGTH characters"
        }

        val roleAdmin = findOrCreateRole(ROLE_ADMIN)
        val roleUser = findOrCreateRole(ROLE_USER)
        val existingUser = userRepository.findByUsernameIgnoreCase(normalizedUsername)
        if (existingUser != null) {
            val originalRoleCount = existingUser.roles.size
            existingUser.roles.add(roleAdmin)
            existingUser.roles.add(roleUser)
            if (existingUser.roles.size != originalRoleCount) {
                userRepository.save(existingUser)
            }
            return
        }

        val adminUser = UserEntity().apply {
            this.username = normalizedUsername
            this.email = normalizedEmail
            this.passwordHash = passwordEncoder.encode(password)
            this.enabled = true
            this.roles = mutableSetOf(roleAdmin, roleUser)
        }
        userRepository.save(adminUser)
    }

    private fun findOrCreateRole(roleName: String): RoleEntity {
        return roleRepository.findByName(roleName)
            ?: roleRepository.save(
                RoleEntity().apply {
                    name = roleName
                },
            )
    }

    private companion object {
        private const val ROLE_ADMIN: String = "ROLE_ADMIN"
        private const val ROLE_USER: String = "ROLE_USER"
        private const val MIN_BOOTSTRAP_PASSWORD_LENGTH: Int = 12
    }
}
