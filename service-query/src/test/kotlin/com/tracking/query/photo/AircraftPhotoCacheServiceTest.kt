package com.tracking.query.photo

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import java.nio.file.Files
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test

class AircraftPhotoCacheServiceTest {

    @Test
    fun `should fetch and store queued aircraft photo locally`() {
        val tempDir = Files.createTempDirectory("photo-cache-test")
        val archive = AircraftPhotoArchive(
            ObjectMapper().registerKotlinModule().registerModule(JavaTimeModule()),
            tempDir.toString(),
        )
        val client =
            object : PlanespottersPhotoClient(
                ObjectMapper().registerKotlinModule().registerModule(JavaTimeModule()),
            ) {
                override fun fetchPhoto(icao: String): RemoteAircraftPhoto? =
                    RemoteAircraftPhoto(
                        bytes = byteArrayOf(1, 2, 3),
                        contentType = "image/jpeg",
                        sourceUrl = "https://cdn.planespotters.net/photo/test.jpg",
                    )
            }

        val service =
            AircraftPhotoCacheService(
                archive = archive,
                planespottersPhotoClient = client,
                batchSize = 1,
                failureTtlMinutes = 30,
                maxEntryAgeHours = 168,
                maxEntries = 100,
            )

        service.enqueueWarmup("ABC123")
        service.warmQueuedPhotos()

        service.loadCachedPhoto("ABC123").shouldNotBeNull {
            icao shouldBe "ABC123"
            contentType shouldBe "image/jpeg"
            bytes.map { it.toInt() } shouldBe listOf(1, 2, 3)
            assertNotNull(cachedAt)
        }

        service.loadCachedPhotoMetadata("ABC123").let { metadata ->
            metadata.icao shouldBe "ABC123"
            metadata.cacheHit shouldBe true
            metadata.contentType shouldBe "image/jpeg"
            metadata.sourceUrl shouldBe "https://cdn.planespotters.net/photo/test.jpg"
            metadata.localPhotoUrl shouldBe "/api/v1/aircraft/ABC123/photo/local"
            assertNotNull(metadata.cachedAt)
        }
    }
}
