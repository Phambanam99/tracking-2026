package com.tracking.auth.watchlist

import org.springframework.data.jpa.repository.JpaRepository

public interface WatchlistEntryRepository : JpaRepository<WatchlistEntryEntity, Long> {
    public fun findByGroupId(groupId: Long): List<WatchlistEntryEntity>
    public fun countByGroupId(groupId: Long): Long
    public fun findByGroupIdAndIcao(groupId: Long, icao: String): WatchlistEntryEntity?
}
