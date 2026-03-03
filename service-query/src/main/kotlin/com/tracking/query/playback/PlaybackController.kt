package com.tracking.query.playback

import com.tracking.query.dto.PlaybackFrameRequest
import com.tracking.query.dto.PlaybackFrameResponse
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/playback")
public class PlaybackController(
    private val playbackService: PlaybackService,
) {
    @PostMapping("/frames")
    public fun getPlaybackFrames(
        @RequestBody @Valid request: PlaybackFrameRequest,
    ): ResponseEntity<PlaybackFrameResponse> =
        ResponseEntity.ok(playbackService.getPlaybackFrames(request))
}
