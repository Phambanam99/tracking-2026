package com.tracking.auth.security

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
public interface JwtSigningKeyRepository : JpaRepository<JwtSigningKeyEntity, String> {
    public fun findByActiveTrue(): JwtSigningKeyEntity?

    public fun findAllByOrderByCreatedAtDesc(): List<JwtSigningKeyEntity>
}
