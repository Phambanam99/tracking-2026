package com.tracking.query.photo

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty
import com.fasterxml.jackson.databind.ObjectMapper
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component
public open class PlanespottersPhotoClient(
    private val objectMapper: ObjectMapper,
    @Value("\${tracking.query.photo-cache.planespotters-base-url:https://api.planespotters.net/pub/photos/hex}")
    private val apiBaseUrl: String = DEFAULT_BASE_URL,
    @Value("\${tracking.query.photo-cache.request-timeout-millis:2500}")
    requestTimeoutMillis: Long = DEFAULT_TIMEOUT_MILLIS,
) {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val requestTimeout: Duration = Duration.ofMillis(requestTimeoutMillis)
    private val httpClient: HttpClient =
        HttpClient.newBuilder()
            .connectTimeout(requestTimeout)
            .build()

    public open fun fetchPhoto(icao: String): RemoteAircraftPhoto? {
        val normalizedIcao = normalizeHex(icao) ?: return null
        val metadataEndpoint = "$apiBaseUrl/${normalizedIcao.lowercase()}"
        val metadataPayload = getBytes(metadataEndpoint, accept = "application/json") ?: return null
        val payload =
            runCatching {
                objectMapper.readValue(metadataPayload.bytes, PlanespottersPhotosResponse::class.java)
            }.getOrElse { error ->
                logger.debug("Failed to parse Planespotters payload for icao={}", normalizedIcao, error)
                return null
            }

        val photoUrl = payload.photos.firstOrNull()?.thumbnailLarge?.src ?: payload.photos.firstOrNull()?.thumbnail?.src
        if (photoUrl.isNullOrBlank()) {
            return null
        }

        val photoResponse = getBytes(photoUrl, accept = "image/*") ?: return null
        val contentType = photoResponse.contentType?.substringBefore(";")?.trim().orEmpty()
        return RemoteAircraftPhoto(
            bytes = photoResponse.bytes,
            contentType = if (contentType.isBlank()) DEFAULT_CONTENT_TYPE else contentType,
            sourceUrl = photoUrl,
        )
    }

    private fun getBytes(url: String, accept: String): HttpPayload? {
        val request =
            HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(requestTimeout)
                .header("Accept", accept)
                .GET()
                .build()
        val response =
            runCatching {
                httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray())
            }.getOrElse { error ->
                logger.debug("Planespotters request failed for url={}", url, error)
                return null
            }

        if (response.statusCode() !in HTTP_OK_START..HTTP_OK_END) {
            return null
        }
        return HttpPayload(
            bytes = response.body(),
            contentType = response.headers().firstValue("Content-Type").orElse(null),
        )
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

    private data class HttpPayload(
        val bytes: ByteArray,
        val contentType: String?,
    )

    private companion object {
        private const val DEFAULT_BASE_URL: String = "https://api.planespotters.net/pub/photos/hex"
        private const val DEFAULT_TIMEOUT_MILLIS: Long = 2_500
        private const val ICAO_HEX_LENGTH: Int = 6
        private const val HTTP_OK_START: Int = 200
        private const val HTTP_OK_END: Int = 299
        private const val DEFAULT_CONTENT_TYPE: String = "image/jpeg"
    }
}
