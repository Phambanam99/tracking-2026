package com.tracking.query.photo

import com.github.benmanes.caffeine.cache.Caffeine
import java.time.Duration
import java.util.concurrent.ConcurrentLinkedQueue
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service

@Service
public class AircraftPhotoCacheService(
    private val archive: AircraftPhotoArchive,
    private val planespottersPhotoClient: PlanespottersPhotoClient,
    @Value("\${tracking.query.photo-cache.batch-size:2}")
    private val batchSize: Int,
    @Value("\${tracking.query.photo-cache.failure-ttl-minutes:30}")
    failureTtlMinutes: Long,
    @Value("\${tracking.query.photo-cache.max-entry-age-hours:168}")
    private val maxEntryAgeHours: Long,
    @Value("\${tracking.query.photo-cache.max-entries:5000}")
    private val maxEntries: Int,
) {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val pendingIcaos: ConcurrentLinkedQueue<String> = ConcurrentLinkedQueue()
    private val queuedIcaos =
        Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofHours(6))
            .maximumSize(100_000)
            .build<String, Boolean>()
    private val failureBackoff =
        Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofMinutes(failureTtlMinutes))
            .maximumSize(100_000)
            .build<String, Boolean>()

    public fun loadCachedPhoto(icao: String): StoredAircraftPhoto? = archive.load(icao)

    public fun loadCachedPhotoMetadata(icao: String): AircraftPhotoCacheMetadata = archive.loadMetadata(icao)

    public fun enqueueWarmup(icao: String): Unit {
        val normalizedIcao = normalizeHex(icao) ?: return
        if (archive.exists(normalizedIcao)) {
            return
        }
        if (failureBackoff.getIfPresent(normalizedIcao) == true) {
            return
        }
        if (queuedIcaos.asMap().putIfAbsent(normalizedIcao, true) == null) {
            pendingIcaos.offer(normalizedIcao)
        }
    }

    @Scheduled(fixedDelayString = "\${tracking.query.photo-cache.poll-interval-millis:1500}")
    public fun warmQueuedPhotos(): Unit {
        repeat(batchSize.coerceAtLeast(1)) {
            val icao = pendingIcaos.poll() ?: return
            queuedIcaos.invalidate(icao)
            if (archive.exists(icao)) {
                return@repeat
            }

            val remotePhoto =
                runCatching { planespottersPhotoClient.fetchPhoto(icao) }
                    .getOrElse { error ->
                        logger.debug("Failed to fetch remote aircraft photo for icao={}", icao, error)
                        null
                    }

            if (remotePhoto == null) {
                failureBackoff.put(icao, true)
                return@repeat
            }

            archive.save(icao, remotePhoto)
        }
    }

    @Scheduled(fixedDelayString = "\${tracking.query.photo-cache.cleanup-interval-millis:3600000}")
    public fun cleanupCachedPhotos(): Unit {
        val removed = archive.prune(Duration.ofHours(maxEntryAgeHours.coerceAtLeast(1)), maxEntries)
        if (removed > 0) {
            logger.info("Pruned {} cached aircraft photos", removed)
        }
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

    private companion object {
        private const val ICAO_HEX_LENGTH: Int = 6
    }
}
