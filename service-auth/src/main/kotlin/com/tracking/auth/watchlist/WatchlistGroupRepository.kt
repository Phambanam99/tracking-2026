package com.tracking.auth.watchlist

import org.springframework.data.jpa.repository.JpaRepository

public interface WatchlistGroupRepository : JpaRepository<WatchlistGroupEntity, Long> {
    public fun findByUserId(userId: Long): List<WatchlistGroupEntity>
    public fun countByUserId(userId: Long): Long
}
