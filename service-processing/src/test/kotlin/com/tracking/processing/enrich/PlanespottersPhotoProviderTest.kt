package com.tracking.processing.enrich

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.kotest.matchers.shouldBe
import java.time.Duration
import kotlin.test.Test

public class PlanespottersPhotoProviderTest {
    private val objectMapper = jacksonObjectMapper()

    @Test
    public fun `should resolve thumbnail large src from planespotters payload`() {
        val fetcher = RecordingFetcher(successPayload = payloadWithLargeThumbnail())
        val provider =
            PlanespottersPhotoProvider(
                objectMapper = objectMapper,
                apiBaseUrl = "https://api.planespotters.net/pub/photos/hex",
                requestTimeout = Duration.ofMillis(500),
                cacheTtl = Duration.ofMinutes(10),
                cacheMaxSize = 100,
                payloadFetcher = fetcher,
            )

        val imageUrl = provider.photoUrlFor("888123")

        imageUrl shouldBe "https://t.plnspttrs.net/44498/1861391_63c9f4399f_280.jpg"
        fetcher.calls shouldBe 1
    }

    @Test
    public fun `should fallback to thumbnail src when large thumbnail is missing`() {
        val fetcher = RecordingFetcher(successPayload = payloadWithSmallThumbnailOnly())
        val provider =
            PlanespottersPhotoProvider(
                objectMapper = objectMapper,
                requestTimeout = Duration.ofMillis(500),
                cacheTtl = Duration.ofMinutes(10),
                cacheMaxSize = 100,
                payloadFetcher = fetcher,
            )

        val imageUrl = provider.photoUrlFor("888124")

        imageUrl shouldBe "https://t.plnspttrs.net/44498/1861391_small.jpg"
    }

    @Test
    public fun `should cache photo url to avoid repeated remote calls`() {
        val fetcher = RecordingFetcher(successPayload = payloadWithLargeThumbnail())
        val provider =
            PlanespottersPhotoProvider(
                objectMapper = objectMapper,
                requestTimeout = Duration.ofMillis(500),
                cacheTtl = Duration.ofMinutes(10),
                cacheMaxSize = 100,
                payloadFetcher = fetcher,
            )

        val first = provider.photoUrlFor("888123")
        val second = provider.photoUrlFor("888123")

        first shouldBe "https://t.plnspttrs.net/44498/1861391_63c9f4399f_280.jpg"
        second shouldBe first
        fetcher.calls shouldBe 1
    }

    @Test
    public fun `should return null for invalid or malformed response`() {
        val malformedFetcher = RecordingFetcher(successPayload = """{"photos":[{"id":1}]}""")
        val provider =
            PlanespottersPhotoProvider(
                objectMapper = objectMapper,
                requestTimeout = Duration.ofMillis(500),
                cacheTtl = Duration.ofMinutes(10),
                cacheMaxSize = 100,
                payloadFetcher = malformedFetcher,
            )

        provider.photoUrlFor("NOTHEX") shouldBe null
        provider.photoUrlFor("888123") shouldBe null
    }

    private class RecordingFetcher(
        private val successPayload: String,
    ) : PhotoPayloadFetcher {
        var calls: Int = 0

        override fun fetch(url: String, timeout: Duration): String? {
            calls += 1
            return successPayload
        }
    }

    private fun payloadWithLargeThumbnail(): String =
        """
        {
          "photos": [
            {
              "id": "1861391",
              "thumbnail": {
                "src": "https://t.plnspttrs.net/44498/1861391_63c9f4399f_t.jpg",
                "size": {"width": 200, "height": 133}
              },
              "thumbnail_large": {
                "src": "https://t.plnspttrs.net/44498/1861391_63c9f4399f_280.jpg",
                "size": {"width": 419, "height": 280}
              }
            }
          ]
        }
        """.trimIndent()

    private fun payloadWithSmallThumbnailOnly(): String =
        """
        {
          "photos": [
            {
              "id": "1861391",
              "thumbnail": {
                "src": "https://t.plnspttrs.net/44498/1861391_small.jpg",
                "size": {"width": 200, "height": 133}
              }
            }
          ]
        }
        """.trimIndent()
}
