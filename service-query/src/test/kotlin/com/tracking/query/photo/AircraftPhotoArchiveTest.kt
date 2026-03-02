package com.tracking.query.photo

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import java.nio.file.Files
import java.nio.file.attribute.FileTime
import java.time.Duration
import java.time.Instant
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test

class AircraftPhotoArchiveTest {

    @Test
    fun `should prune stale and overflow cached photos`() {
        val tempDir = Files.createTempDirectory("photo-archive-test")
        val archive = AircraftPhotoArchive(
            ObjectMapper().registerKotlinModule().registerModule(JavaTimeModule()),
            tempDir.toString(),
        )

        archive.save("ABC123", remotePhoto("https://cdn.planespotters.net/photo/abc123.jpg"))
        archive.save("DEF456", remotePhoto("https://cdn.planespotters.net/photo/def456.jpg"))
        archive.save("FEDCBA", remotePhoto("https://cdn.planespotters.net/photo/fedcba.jpg"))

        setLastModified(tempDir, "ABC123", Instant.now().minus(Duration.ofDays(10)))
        setLastModified(tempDir, "DEF456", Instant.now().minus(Duration.ofDays(2)))
        setLastModified(tempDir, "FEDCBA", Instant.now())

        val removed = archive.prune(maxAge = Duration.ofDays(7), maxEntries = 1)

        removed shouldBe 2
        archive.load("ABC123").shouldBeNull()
        archive.load("DEF456").shouldBeNull()
        archive.load("FEDCBA")?.icao shouldBe "FEDCBA"
    }

    @Test
    fun `should read legacy cached photo metadata without cached at`() {
        val tempDir = Files.createTempDirectory("photo-archive-legacy-test")
        val archive = AircraftPhotoArchive(
            ObjectMapper().registerKotlinModule().registerModule(JavaTimeModule()),
            tempDir.toString(),
        )
        val metadataPath = tempDir.resolve("ABC123.json")
        val imagePath = tempDir.resolve("ABC123.bin")

        Files.writeString(
            metadataPath,
            """{"icao":"ABC123","contentType":"image/jpeg","sourceUrl":"https://cdn.planespotters.net/photo/test.jpg"}""",
        )
        Files.write(imagePath, byteArrayOf(1, 2, 3))
        val modifiedAt = Instant.parse("2026-03-02T07:00:00Z")
        Files.setLastModifiedTime(metadataPath, FileTime.from(modifiedAt))
        Files.setLastModifiedTime(imagePath, FileTime.from(modifiedAt))

        val metadata = archive.loadMetadata("ABC123")

        metadata.icao shouldBe "ABC123"
        metadata.cacheHit shouldBe true
        metadata.sourceUrl shouldBe "https://cdn.planespotters.net/photo/test.jpg"
        metadata.contentType shouldBe "image/jpeg"
        metadata.cachedAt shouldBe modifiedAt
        metadata.localPhotoUrl shouldBe "/api/v1/aircraft/ABC123/photo/local"
        assertNotNull(archive.load("ABC123")?.cachedAt)
    }

    private fun remotePhoto(sourceUrl: String): RemoteAircraftPhoto =
        RemoteAircraftPhoto(
            bytes = byteArrayOf(1, 2, 3),
            contentType = "image/jpeg",
            sourceUrl = sourceUrl,
        )

    private fun setLastModified(root: java.nio.file.Path, icao: String, instant: Instant) {
        val fileTime = FileTime.from(instant)
        Files.setLastModifiedTime(root.resolve("$icao.bin"), fileTime)
        Files.setLastModifiedTime(root.resolve("$icao.json"), fileTime)
    }
}
