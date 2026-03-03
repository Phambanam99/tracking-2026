package com.tracking.query.dto

import jakarta.validation.constraints.Max
import jakarta.validation.constraints.NotNull

public data class PlaybackFrameRequest(
    @field:NotNull
    val timeFrom: Long,
    @field:NotNull
    val timeTo: Long,
    @field:NotNull
    val boundingBox: BoundingBoxDto,
    val bucketSizeMs: Long? = null,
    @field:Max(500)
    val maxFrames: Int = 200,
    val cursor: String? = null,
    val stalenessMs: Long? = null,
) {
    init {
        require(timeFrom < timeTo) { "timeFrom must be before timeTo" }
        require(timeTo - timeFrom <= MAX_TIME_RANGE_MS) { "Maximum time range is 7 days" }
    }

    public companion object {
        public const val MAX_TIME_RANGE_MS: Long = 7L * 24 * 60 * 60 * 1000
    }
}
