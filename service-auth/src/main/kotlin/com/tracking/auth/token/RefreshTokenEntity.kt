package com.tracking.auth.token

import com.tracking.auth.user.UserEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "refresh_tokens")
public class RefreshTokenEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public var id: Long? = null

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    public lateinit var user: UserEntity

    @Column(name = "token_hash", nullable = false, unique = true, length = 255)
    public lateinit var tokenHash: String

    @Column(name = "expires_at", nullable = false)
    public var expiresAt: Instant = Instant.now()

    @Column(name = "revoked", nullable = false)
    public var revoked: Boolean = false

    @Column(name = "replaced_by_token_hash")
    public var replacedByTokenHash: String? = null

    @Column(name = "created_at", nullable = false, updatable = false)
    public var createdAt: Instant = Instant.now()
}
