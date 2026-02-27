package com.tracking.auth.user

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.JoinTable
import jakarta.persistence.ManyToMany
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "users")
public class UserEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public var id: Long? = null

    @Column(name = "username", nullable = false, unique = true, length = 100)
    public lateinit var username: String

    @Column(name = "email", nullable = false, unique = true, length = 255)
    public lateinit var email: String

    @Column(name = "password_hash", nullable = false, length = 255)
    public lateinit var passwordHash: String

    @Column(name = "enabled", nullable = false) public var enabled: Boolean = true

    @Column(name = "failed_login_attempts", nullable = false)
    public var failedLoginAttempts: Int = 0

    @Column(name = "locked_until") public var lockedUntil: Instant? = null

    @Column(name = "last_login_at") public var lastLoginAt: Instant? = null

    @Column(name = "created_at", nullable = false, updatable = false)
    public var createdAt: Instant = Instant.now()

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "user_roles",
            joinColumns = [JoinColumn(name = "user_id", referencedColumnName = "id")],
            inverseJoinColumns = [JoinColumn(name = "role_id", referencedColumnName = "id")],
    )
    public var roles: MutableSet<RoleEntity> = mutableSetOf()

    public fun roleNames(): Set<String> = roles.mapTo(mutableSetOf()) { role -> role.name }

    public fun isLockedOut(): Boolean {
        return lockedUntil != null && lockedUntil!!.isAfter(Instant.now())
    }
}
