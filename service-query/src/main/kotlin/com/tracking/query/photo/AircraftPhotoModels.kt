package com.tracking.query.photo

import java.time.Instant

public data class StoredAircraftPhoto(
    val icao: String,
    val bytes: ByteArray,
    val contentType: String,
    val sourceUrl: String,
    val cachedAt: Instant,
)

internal data class StoredAircraftPhotoMetadata(
    val icao: String,
    val contentType: String,
    val sourceUrl: String,
    val cachedAt: Instant?,
)

public data class RemoteAircraftPhoto(
    val bytes: ByteArray,
    val contentType: String,
    val sourceUrl: String,
)

public data class AircraftPhotoCacheMetadata(
    val icao: String,
    val cacheHit: Boolean,
    val sourceUrl: String?,
    val cachedAt: Instant?,
    val contentType: String?,
    val localPhotoUrl: String?,
)
