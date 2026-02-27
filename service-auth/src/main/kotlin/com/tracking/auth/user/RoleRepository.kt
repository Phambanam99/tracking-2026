package com.tracking.auth.user

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
public interface RoleRepository : JpaRepository<RoleEntity, Long> {
    public fun findByName(name: String): RoleEntity?
}
