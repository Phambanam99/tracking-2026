package com.tracking.query.photo

import org.springframework.http.CacheControl
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/aircraft")
public class AircraftPhotoController(
    private val aircraftPhotoCacheService: AircraftPhotoCacheService,
) {
    @GetMapping("/{icao}/photo/local")
    public fun getLocalPhoto(@PathVariable icao: String): ResponseEntity<ByteArray> {
        val photo = aircraftPhotoCacheService.loadCachedPhoto(icao)
        if (photo == null) {
            aircraftPhotoCacheService.enqueueWarmup(icao)
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build()
        }

        return ResponseEntity.ok()
            .cacheControl(CacheControl.noCache())
            .contentType(MediaType.parseMediaType(photo.contentType))
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"${photo.icao.lowercase()}.bin\"")
            .body(photo.bytes)
    }

    @GetMapping("/{icao}/photo/metadata")
    public fun getPhotoMetadata(@PathVariable icao: String): ResponseEntity<AircraftPhotoCacheMetadata> {
        val metadata = aircraftPhotoCacheService.loadCachedPhotoMetadata(icao)
        if (!metadata.cacheHit) {
            aircraftPhotoCacheService.enqueueWarmup(icao)
        }

        return ResponseEntity.ok()
            .cacheControl(CacheControl.noCache())
            .body(metadata)
    }
}
