package com.tracking.auth.watchlist

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "watchlist_entries")
public class WatchlistEntryEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public var id: Long? = null

    @Column(name = "group_id", nullable = false)
    public var groupId: Long = 0L

    @Column(name = "icao", nullable = false, length = 6)
    public lateinit var icao: String

    @Column(name = "note", length = 500)
    public var note: String? = null

    @Column(name = "added_at", nullable = false, updatable = false)
    public var addedAt: Instant = Instant.now()
}
