package com.tracking.processing.enrich

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty
import com.fasterxml.jackson.databind.ObjectMapper
import com.github.benmanes.caffeine.cache.Cache
import com.github.benmanes.caffeine.cache.Caffeine
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import org.slf4j.LoggerFactory

public fun interface AircraftPhotoProvider {
    public fun photoUrlFor(icao: String): String?
}

public object NoopAircraftPhotoProvider : AircraftPhotoProvider {
    override fun photoUrlFor(icao: String): String? = null
}

public fun interface PhotoPayloadFetcher {
    public fun fetch(url: String, timeout: Duration): String?
}

public class HttpClientPhotoPayloadFetcher(
    private val httpClient: HttpClient =
        HttpClient.newBuilder()
            .connectTimeout(DEFAULT_CONNECT_TIMEOUT)
            .build(),
) : PhotoPayloadFetcher {
    override fun fetch(url: String, timeout: Duration): String? {
        val request =
            HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(timeout)
                .GET()
                .build()

        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() !in HTTP_OK_START..HTTP_OK_END) {
            return null
        }

        return response.body()
    }

    private companion object {
        private val DEFAULT_CONNECT_TIMEOUT: Duration = Duration.ofMillis(500)
        private const val HTTP_OK_START: Int = 200
        private const val HTTP_OK_END: Int = 299
    }
}

public class PlanespottersPhotoProvider(
    private val objectMapper: ObjectMapper,
    private val apiBaseUrl: String = DEFAULT_BASE_URL,
    private val requestTimeout: Duration = Duration.ofMillis(700),
    cacheTtl: Duration = Duration.ofMinutes(30),
    cacheMaxSize: Long = 100_000,
    private val payloadFetcher: PhotoPayloadFetcher = HttpClientPhotoPayloadFetcher(),
) : AircraftPhotoProvider {
    private val logger = LoggerFactory.getLogger(PlanespottersPhotoProvider::class.java)
    private val photoCache: Cache<String, CachedPhotoResult> =
        Caffeine.newBuilder()
            .maximumSize(cacheMaxSize)
            .expireAfterWrite(cacheTtl)
            .build()

    override fun photoUrlFor(icao: String): String? {
        val normalizedIcao = normalizeHex(icao) ?: return null
        val cached = photoCache.getIfPresent(normalizedIcao)
        if (cached != null) {
            return cached.url
        }

        val resolvedUrl = resolveFromApi(normalizedIcao)
        photoCache.put(normalizedIcao, CachedPhotoResult(resolvedUrl))
        return resolvedUrl
    }

    private fun resolveFromApi(normalizedIcao: String): String? {
        val endpoint = "$apiBaseUrl/${normalizedIcao.lowercase()}"
        val payload =
            runCatching { payloadFetcher.fetch(endpoint, requestTimeout) }
                .getOrElse { error ->
                    logger.debug("Planespotters fetch failed for icao={}", normalizedIcao, error)
                    null
                } ?: return null

        val response =
            runCatching { objectMapper.readValue(payload, PlanespottersPhotosResponse::class.java) }
                .getOrElse { error ->
                    logger.debug("Planespotters payload parse failed for icao={}", normalizedIcao, error)
                    return null
                }

        val firstPhoto = response.photos.firstOrNull() ?: return null
        return firstPhoto.thumbnailLarge?.src ?: firstPhoto.thumbnail?.src
    }

    private fun normalizeHex(icao: String): String? {
        val normalized = icao.trim().uppercase()
        if (normalized.length != ICAO_HEX_LENGTH) {
            return null
        }
        if (!normalized.all { it.isDigit() || it in 'A'..'F' }) {
            return null
        }
        return normalized
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class PlanespottersPhotosResponse(
        val photos: List<PlanespottersPhoto> = emptyList(),
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class PlanespottersPhoto(
        val thumbnail: PlanespottersThumbnail? = null,
        @JsonProperty("thumbnail_large")
        val thumbnailLarge: PlanespottersThumbnail? = null,
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class PlanespottersThumbnail(
        val src: String? = null,
    )

    private data class CachedPhotoResult(
        val url: String?,
    )

    private companion object {
        private const val DEFAULT_BASE_URL: String = "https://api.planespotters.net/pub/photos/hex"
        private const val ICAO_HEX_LENGTH: Int = 6
    }
}
