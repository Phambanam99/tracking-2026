package com.tracking.auth.watchlist

import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

@Service
public class WatchlistService(
    private val groupRepo: WatchlistGroupRepository,
    private val entryRepo: WatchlistEntryRepository,
) {
    private val log = LoggerFactory.getLogger(WatchlistService::class.java)

    @Transactional(readOnly = true)
    public fun getGroupsByUser(userId: Long): List<WatchlistGroupDto> =
        groupRepo.findByUserId(userId).map { group ->
            group.toDto(entryCount = entryRepo.countByGroupId(group.id!!))
        }

    @Transactional(readOnly = true)
    public fun getGroupWithEntries(userId: Long, groupId: Long): WatchlistGroupDto {
        val group = findOwnedGroup(userId, groupId)
        val entries = entryRepo.findByGroupId(group.id!!)
        return group.toDto(
            entryCount = entries.size.toLong(),
            entries = entries.map { it.toDto() },
        )
    }

    @Transactional
    public fun createGroup(userId: Long, request: CreateGroupRequest): WatchlistGroupDto {
        val currentCount = groupRepo.countByUserId(userId)
        if (currentCount >= MAX_GROUPS_PER_USER) {
            throw WatchlistLimitExceededException(
                "Maximum $MAX_GROUPS_PER_USER groups per user exceeded"
            )
        }
        val entity = WatchlistGroupEntity().apply {
            this.userId = userId
            this.name = request.name.trim()
            this.color = request.color ?: DEFAULT_COLOR
        }
        val saved = groupRepo.save(entity)
        log.info("Watchlist group created: userId={}, groupId={}, name={}", userId, saved.id, saved.name)
        return saved.toDto(entryCount = 0)
    }

    @Transactional
    public fun updateGroup(userId: Long, groupId: Long, request: UpdateGroupRequest): WatchlistGroupDto {
        val group = findOwnedGroup(userId, groupId)
        request.name?.let { group.name = it.trim() }
        request.color?.let { group.color = it }
        val saved = groupRepo.save(group)
        return saved.toDto(entryCount = entryRepo.countByGroupId(saved.id!!))
    }

    @Transactional
    public fun deleteGroup(userId: Long, groupId: Long) {
        val group = findOwnedGroup(userId, groupId)
        groupRepo.delete(group)
        log.info("Watchlist group deleted: userId={}, groupId={}", userId, groupId)
    }

    @Transactional
    public fun addAircraft(userId: Long, groupId: Long, request: AddAircraftRequest): WatchlistEntryDto {
        val group = findOwnedGroup(userId, groupId)
        val currentCount = entryRepo.countByGroupId(group.id!!)
        if (currentCount >= MAX_ENTRIES_PER_GROUP) {
            throw WatchlistLimitExceededException(
                "Maximum $MAX_ENTRIES_PER_GROUP entries per group exceeded"
            )
        }
        val entry = WatchlistEntryEntity().apply {
            this.groupId = group.id!!
            this.icao = request.icao.uppercase()
            this.note = request.note
        }
        return entryRepo.save(entry).toDto()
    }

    @Transactional
    public fun addAircraftBatch(
        userId: Long,
        groupId: Long,
        request: BatchAddAircraftRequest,
    ): List<WatchlistEntryDto> {
        val group = findOwnedGroup(userId, groupId)
        val currentCount = entryRepo.countByGroupId(group.id!!)
        if (currentCount + request.entries.size > MAX_ENTRIES_PER_GROUP) {
            throw WatchlistLimitExceededException(
                "Adding ${request.entries.size} entries would exceed the limit of $MAX_ENTRIES_PER_GROUP"
            )
        }
        return request.entries.map { req ->
            val entry = WatchlistEntryEntity().apply {
                this.groupId = group.id!!
                this.icao = req.icao.uppercase()
                this.note = req.note
            }
            entryRepo.save(entry).toDto()
        }
    }

    @Transactional
    public fun removeAircraft(userId: Long, groupId: Long, icao: String) {
        val group = findOwnedGroup(userId, groupId)
        val entry = entryRepo.findByGroupIdAndIcao(group.id!!, icao)
            ?: throw WatchlistNotFoundException("Aircraft $icao not found in group ${group.id}")
        entryRepo.delete(entry)
    }

    private fun findOwnedGroup(userId: Long, groupId: Long): WatchlistGroupEntity {
        val group = groupRepo.findById(groupId)
            .orElseThrow { WatchlistNotFoundException("Group $groupId not found") }
        if (group.userId != userId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied")
        }
        return group
    }

    private companion object {
        const val MAX_GROUPS_PER_USER: Long = 20L
        const val MAX_ENTRIES_PER_GROUP: Long = 200L
        const val DEFAULT_COLOR: String = "#3b82f6"
    }
}
