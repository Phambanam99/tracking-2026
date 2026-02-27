package com.tracking.auth.token

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
public interface RefreshTokenRepository : JpaRepository<RefreshTokenEntity, Long> {
    public fun findByTokenHash(tokenHash: String): RefreshTokenEntity?

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        """
        update RefreshTokenEntity token
        set token.revoked = true,
            token.replacedByTokenHash = :replacementTokenHash
        where token.id = :tokenId
          and token.revoked = false
        """,
    )
    public fun markReplacedIfActive(
        @Param("tokenId") tokenId: Long,
        @Param("replacementTokenHash") replacementTokenHash: String,
    ): Int

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        """
        update RefreshTokenEntity token
        set token.revoked = true
        where token.user.id = :userId
          and token.revoked = false
        """,
    )
    public fun revokeAllActiveByUserId(@Param("userId") userId: Long): Int
}
