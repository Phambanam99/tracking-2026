package com.tracking.auth.user

import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
public interface UserRepository : JpaRepository<UserEntity, Long> {
    @EntityGraph(attributePaths = ["roles"])
    public fun findByUsernameIgnoreCase(username: String): UserEntity?

    public fun existsByUsernameIgnoreCase(username: String): Boolean

    public fun existsByEmailIgnoreCase(email: String): Boolean
}
