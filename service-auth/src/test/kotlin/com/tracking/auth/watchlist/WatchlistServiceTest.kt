package com.tracking.auth.watchlist

import java.time.Instant
import java.util.Optional
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException

public class WatchlistServiceTest {

    private val groupRepo: WatchlistGroupRepository = mock(WatchlistGroupRepository::class.java)
    private val entryRepo: WatchlistEntryRepository = mock(WatchlistEntryRepository::class.java)
    private val service = WatchlistService(groupRepo, entryRepo)

    // -----------------------------------------------------------------------
    // getGroupsByUser
    // -----------------------------------------------------------------------

    @Test
    public fun `should return groups for user`() {
        val group = group(id = 1L, userId = 10L, name = "Alpha")
        `when`(groupRepo.findByUserId(10L)).thenReturn(listOf(group))
        `when`(entryRepo.countByGroupId(1L)).thenReturn(3L)

        val result = service.getGroupsByUser(10L)

        assertEquals(1, result.size)
        assertEquals("Alpha", result[0].name)
        assertEquals(3, result[0].entryCount)
    }

    @Test
    public fun `should return empty list when user has no groups`() {
        `when`(groupRepo.findByUserId(99L)).thenReturn(emptyList())

        val result = service.getGroupsByUser(99L)

        assertEquals(0, result.size)
    }

    // -----------------------------------------------------------------------
    // createGroup
    // -----------------------------------------------------------------------

    @Test
    public fun `should create a group with default color`() {
        `when`(groupRepo.countByUserId(10L)).thenReturn(0L)
        val saved = group(id = 5L, userId = 10L, name = "Bravo", color = "#3b82f6")
        `when`(groupRepo.save(any(WatchlistGroupEntity::class.java))).thenReturn(saved)
        `when`(entryRepo.countByGroupId(5L)).thenReturn(0L)

        val result = service.createGroup(10L, CreateGroupRequest(name = "Bravo"))

        assertEquals("Bravo", result.name)
        assertEquals("#3b82f6", result.color)
    }

    @Test
    public fun `should create a group with custom color`() {
        `when`(groupRepo.countByUserId(10L)).thenReturn(2L)
        val saved = group(id = 6L, userId = 10L, name = "Charlie", color = "#ef4444")
        `when`(groupRepo.save(any(WatchlistGroupEntity::class.java))).thenReturn(saved)
        `when`(entryRepo.countByGroupId(6L)).thenReturn(0L)

        val result = service.createGroup(10L, CreateGroupRequest(name = "Charlie", color = "#ef4444"))

        assertEquals("#ef4444", result.color)
    }

    @Test
    public fun `should reject group creation when limit reached`() {
        `when`(groupRepo.countByUserId(10L)).thenReturn(20L)

        assertThrows<WatchlistLimitExceededException> {
            service.createGroup(10L, CreateGroupRequest(name = "Overflow"))
        }

        verify(groupRepo, never()).save(any())
    }

    // -----------------------------------------------------------------------
    // deleteGroup — ownership guard
    // -----------------------------------------------------------------------

    @Test
    public fun `should delete owned group`() {
        val group = group(id = 1L, userId = 10L)
        `when`(groupRepo.findById(1L)).thenReturn(Optional.of(group))

        service.deleteGroup(userId = 10L, groupId = 1L)

        verify(groupRepo, times(1)).delete(group)
    }

    @Test
    public fun `should reject delete when group belongs to different user`() {
        val group = group(id = 1L, userId = 99L) // different owner
        `when`(groupRepo.findById(1L)).thenReturn(Optional.of(group))

        val ex = assertThrows<ResponseStatusException> {
            service.deleteGroup(userId = 10L, groupId = 1L)
        }

        assertEquals(HttpStatus.FORBIDDEN, ex.statusCode)
        verify(groupRepo, never()).delete(any())
    }

    @Test
    public fun `should throw not found when deleting non-existent group`() {
        `when`(groupRepo.findById(999L)).thenReturn(Optional.empty())

        assertThrows<WatchlistNotFoundException> {
            service.deleteGroup(userId = 10L, groupId = 999L)
        }
    }

    // -----------------------------------------------------------------------
    // addAircraft
    // -----------------------------------------------------------------------

    @Test
    public fun `should add aircraft to group and uppercase icao`() {
        val group = group(id = 1L, userId = 10L)
        `when`(groupRepo.findById(1L)).thenReturn(Optional.of(group))
        `when`(entryRepo.countByGroupId(1L)).thenReturn(0L)
        val entry = entry(id = 1L, groupId = 1L, icao = "ABC123")
        `when`(entryRepo.save(any(WatchlistEntryEntity::class.java))).thenReturn(entry)

        val result = service.addAircraft(10L, 1L, AddAircraftRequest(icao = "abc123"))

        assertEquals("ABC123", result.icao)
    }

    @Test
    public fun `should reject aircraft when entry limit reached`() {
        val group = group(id = 1L, userId = 10L)
        `when`(groupRepo.findById(1L)).thenReturn(Optional.of(group))
        `when`(entryRepo.countByGroupId(1L)).thenReturn(200L)

        assertThrows<WatchlistLimitExceededException> {
            service.addAircraft(10L, 1L, AddAircraftRequest(icao = "abc123"))
        }

        verify(entryRepo, never()).save(any())
    }

    // -----------------------------------------------------------------------
    // removeAircraft
    // -----------------------------------------------------------------------

    @Test
    public fun `should remove aircraft from group`() {
        val group = group(id = 1L, userId = 10L)
        val entry = entry(id = 1L, groupId = 1L, icao = "ABC123")
        `when`(groupRepo.findById(1L)).thenReturn(Optional.of(group))
        `when`(entryRepo.findByGroupIdAndIcao(1L, "ABC123")).thenReturn(entry)

        service.removeAircraft(userId = 10L, groupId = 1L, icao = "ABC123")

        verify(entryRepo, times(1)).delete(entry)
    }

    @Test
    public fun `should throw not found when removing non-existent aircraft`() {
        val group = group(id = 1L, userId = 10L)
        `when`(groupRepo.findById(1L)).thenReturn(Optional.of(group))
        `when`(entryRepo.findByGroupIdAndIcao(1L, "ZZZZZZ")).thenReturn(null)

        assertThrows<WatchlistNotFoundException> {
            service.removeAircraft(userId = 10L, groupId = 1L, icao = "ZZZZZZ")
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private fun group(
        id: Long = 1L,
        userId: Long = 10L,
        name: String = "Test Group",
        color: String = "#3b82f6",
    ): WatchlistGroupEntity = WatchlistGroupEntity().apply {
        this.id = id
        this.userId = userId
        this.name = name
        this.color = color
        this.createdAt = Instant.now()
        this.updatedAt = Instant.now()
    }

    private fun entry(
        id: Long = 1L,
        groupId: Long = 1L,
        icao: String = "ABC123",
        note: String? = null,
    ): WatchlistEntryEntity = WatchlistEntryEntity().apply {
        this.id = id
        this.groupId = groupId
        this.icao = icao
        this.note = note
    }
}
