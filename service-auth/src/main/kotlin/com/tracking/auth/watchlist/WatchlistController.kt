package com.tracking.auth.watchlist

import com.tracking.auth.security.UserPrincipal
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/watchlist")
public class WatchlistController(
    private val watchlistService: WatchlistService,
) {
    @GetMapping
    public fun listGroups(
        @AuthenticationPrincipal user: UserPrincipal,
    ): ResponseEntity<List<WatchlistGroupDto>> =
        ResponseEntity.ok(watchlistService.getGroupsByUser(user.id))

    @GetMapping("/{groupId}")
    public fun getGroup(
        @AuthenticationPrincipal user: UserPrincipal,
        @PathVariable groupId: Long,
    ): ResponseEntity<WatchlistGroupDto> =
        ResponseEntity.ok(watchlistService.getGroupWithEntries(user.id, groupId))

    @PostMapping
    public fun createGroup(
        @AuthenticationPrincipal user: UserPrincipal,
        @RequestBody @Valid request: CreateGroupRequest,
    ): ResponseEntity<WatchlistGroupDto> {
        val group = watchlistService.createGroup(user.id, request)
        return ResponseEntity.status(HttpStatus.CREATED).body(group)
    }

    @PutMapping("/{groupId}")
    public fun updateGroup(
        @AuthenticationPrincipal user: UserPrincipal,
        @PathVariable groupId: Long,
        @RequestBody @Valid request: UpdateGroupRequest,
    ): ResponseEntity<WatchlistGroupDto> =
        ResponseEntity.ok(watchlistService.updateGroup(user.id, groupId, request))

    @DeleteMapping("/{groupId}")
    public fun deleteGroup(
        @AuthenticationPrincipal user: UserPrincipal,
        @PathVariable groupId: Long,
    ): ResponseEntity<Void> {
        watchlistService.deleteGroup(user.id, groupId)
        return ResponseEntity.noContent().build()
    }

    @PostMapping("/{groupId}/aircraft")
    public fun addAircraft(
        @AuthenticationPrincipal user: UserPrincipal,
        @PathVariable groupId: Long,
        @RequestBody @Valid request: AddAircraftRequest,
    ): ResponseEntity<WatchlistEntryDto> {
        val entry = watchlistService.addAircraft(user.id, groupId, request)
        return ResponseEntity.status(HttpStatus.CREATED).body(entry)
    }

    @PostMapping("/{groupId}/aircraft/batch")
    public fun addAircraftBatch(
        @AuthenticationPrincipal user: UserPrincipal,
        @PathVariable groupId: Long,
        @RequestBody @Valid request: BatchAddAircraftRequest,
    ): ResponseEntity<List<WatchlistEntryDto>> {
        val entries = watchlistService.addAircraftBatch(user.id, groupId, request)
        return ResponseEntity.status(HttpStatus.CREATED).body(entries)
    }

    @DeleteMapping("/{groupId}/aircraft/{icao}")
    public fun removeAircraft(
        @AuthenticationPrincipal user: UserPrincipal,
        @PathVariable groupId: Long,
        @PathVariable icao: String,
    ): ResponseEntity<Void> {
        watchlistService.removeAircraft(user.id, groupId, icao.uppercase())
        return ResponseEntity.noContent().build()
    }
}
