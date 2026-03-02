package com.tracking.auth.watchlist

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "watchlist_groups")
public class WatchlistGroupEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public var id: Long? = null

    @Column(name = "user_id", nullable = false)
    public var userId: Long = 0L

    @Column(name = "name", nullable = false, length = 100)
    public lateinit var name: String

    @Column(name = "color", nullable = false, length = 7)
    public var color: String = "#3b82f6"

    @Column(name = "created_at", nullable = false, updatable = false)
    public var createdAt: Instant = Instant.now()

    @Column(name = "updated_at", nullable = false)
    public var updatedAt: Instant = Instant.now()
}
