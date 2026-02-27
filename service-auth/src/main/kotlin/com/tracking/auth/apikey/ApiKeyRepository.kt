package com.tracking.auth.apikey

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
public interface ApiKeyRepository : JpaRepository<ApiKeyEntity, Long> {
    public fun findByKeyHashAndActiveTrue(keyHash: String): ApiKeyEntity?
}
