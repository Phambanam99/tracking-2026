package com.tracking.query.dto

public data class PlaybackFrameResponse(
    val frames: List<PlaybackFrameDto>,
    val totalFrames: Int,
    val returnedFrames: Int,
    val hasMore: Boolean,
    val nextCursor: String?,
    val bucketSizeMs: Long,
    val metadata: PlaybackFrameMetadataDto,
)

public data class PlaybackFrameMetadataDto(
    val queryTimeMs: Long,
    val totalAircraftSeen: Int,
)

public data class PlaybackFrameDto(
    val timestamp: Long,
    val aircraft: List<PlaybackAircraftDto>,
)

public data class PlaybackAircraftDto(
    val icao: String,
    val lat: Double,
    val lon: Double,
    val altitude: Int? = null,
    val speed: Double? = null,
    val heading: Double? = null,
    val eventTime: Long,
    val sourceId: String? = null,
    val registration: String? = null,
    val aircraftType: String? = null,
    val operator: String? = null,
)
