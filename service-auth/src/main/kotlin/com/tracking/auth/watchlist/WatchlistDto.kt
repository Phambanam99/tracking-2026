package com.tracking.auth.watchlist

import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size

public data class CreateGroupRequest(
    @field:NotBlank
    @field:Size(min = 1, max = 100)
    val name: String,

    @field:Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "Color must be hex format: #RRGGBB")
    val color: String? = null,
)

public data class UpdateGroupRequest(
    @field:Size(min = 1, max = 100)
    val name: String? = null,

    @field:Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "Color must be hex format: #RRGGBB")
    val color: String? = null,
)

public data class AddAircraftRequest(
    @field:NotBlank
    @field:Pattern(regexp = "^[0-9A-Fa-f]{6}$", message = "ICAO must be 6 hex characters")
    val icao: String,

    @field:Size(max = 500)
    val note: String? = null,
)

public data class BatchAddAircraftRequest(
    @field:Valid
    @field:Size(min = 1, max = 50, message = "Batch size must be between 1 and 50")
    val entries: List<AddAircraftRequest>,
)

public data class WatchlistGroupDto(
    val id: Long,
    val name: String,
    val color: String,
    val entryCount: Int,
    val entries: List<WatchlistEntryDto>? = null,
    val createdAt: String,
    val updatedAt: String,
)

public data class WatchlistEntryDto(
    val id: Long,
    val groupId: Long,
    val icao: String,
    val note: String?,
    val addedAt: String,
)

internal fun WatchlistGroupEntity.toDto(
    entryCount: Long = 0,
    entries: List<WatchlistEntryDto>? = null,
): WatchlistGroupDto = WatchlistGroupDto(
    id = id!!,
    name = name,
    color = color,
    entryCount = entryCount.toInt(),
    entries = entries,
    createdAt = createdAt.toString(),
    updatedAt = updatedAt.toString(),
)

internal fun WatchlistEntryEntity.toDto(): WatchlistEntryDto = WatchlistEntryDto(
    id = id!!,
    groupId = groupId,
    icao = icao,
    note = note,
    addedAt = addedAt.toString(),
)
