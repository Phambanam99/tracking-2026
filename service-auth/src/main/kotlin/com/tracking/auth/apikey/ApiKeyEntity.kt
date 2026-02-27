package com.tracking.auth.apikey

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "api_keys")
public class ApiKeyEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public var id: Long? = null

    @Column(name = "key_hash", nullable = false, unique = true, length = 255)
    public lateinit var keyHash: String

    @Column(name = "source_id", nullable = false, length = 100)
    public lateinit var sourceId: String

    @Column(name = "active", nullable = false)
    public var active: Boolean = true

    @Column(name = "created_at", nullable = false, updatable = false)
    public var createdAt: Instant = Instant.now()

    @Column(name = "revoked_at")
    public var revokedAt: Instant? = null
}
