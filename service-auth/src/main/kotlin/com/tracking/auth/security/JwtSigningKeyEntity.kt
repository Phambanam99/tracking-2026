package com.tracking.auth.security

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Lob
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "jwt_signing_keys")
public class JwtSigningKeyEntity {
    @Id
    @Column(name = "kid", nullable = false, length = 100)
    public lateinit var kid: String

    @Lob
    @Column(name = "private_key_der_base64", nullable = false)
    public lateinit var privateKeyDerBase64: String

    @Lob
    @Column(name = "public_key_der_base64", nullable = false)
    public lateinit var publicKeyDerBase64: String

    @Column(name = "active", nullable = false)
    public var active: Boolean = false

    @Column(name = "created_at", nullable = false, updatable = false)
    public var createdAt: Instant = Instant.now()

    @Column(name = "retired_at")
    public var retiredAt: Instant? = null
}
