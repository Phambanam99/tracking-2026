package com.tracking.query.photo

import com.fasterxml.jackson.databind.ObjectMapper
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardOpenOption
import java.nio.file.attribute.FileTime
import java.time.Duration
import java.time.Instant
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component
public class AircraftPhotoArchive(
    private val objectMapper: ObjectMapper,
    @Value("\${tracking.query.photo-cache.storage-dir:\${java.io.tmpdir}/tracking-aircraft-photos}")
    storageDir: String,
) {
    private val rootPath: Path = Path.of(storageDir)

    init {
        Files.createDirectories(rootPath)
    }

    public fun load(icao: String): StoredAircraftPhoto? {
        val normalizedIcao = normalizeHex(icao) ?: return null
        val metadataPath = metadataPath(normalizedIcao)
        val imagePath = imagePath(normalizedIcao)
        if (!Files.exists(metadataPath) || !Files.exists(imagePath)) {
            return null
        }

        val metadata = objectMapper.readValue(Files.readAllBytes(metadataPath), StoredAircraftPhotoMetadata::class.java)
        val cachedAt = metadata.cachedAt ?: Files.getLastModifiedTime(metadataPath).toInstant()
        return StoredAircraftPhoto(
            icao = normalizedIcao,
            bytes = Files.readAllBytes(imagePath),
            contentType = metadata.contentType,
            sourceUrl = metadata.sourceUrl,
            cachedAt = cachedAt,
        )
    }

    public fun loadMetadata(icao: String): AircraftPhotoCacheMetadata {
        val normalizedIcao = normalizeHex(icao)
            ?: return AircraftPhotoCacheMetadata(
                icao = icao.trim().uppercase(),
                cacheHit = false,
                sourceUrl = null,
                cachedAt = null,
                contentType = null,
                localPhotoUrl = null,
            )
        val metadataPath = metadataPath(normalizedIcao)
        val imagePath = imagePath(normalizedIcao)
        if (!Files.exists(metadataPath) || !Files.exists(imagePath)) {
            return AircraftPhotoCacheMetadata(
                icao = normalizedIcao,
                cacheHit = false,
                sourceUrl = null,
                cachedAt = null,
                contentType = null,
                localPhotoUrl = null,
            )
        }

        val metadata = objectMapper.readValue(Files.readAllBytes(metadataPath), StoredAircraftPhotoMetadata::class.java)
        return AircraftPhotoCacheMetadata(
            icao = normalizedIcao,
            cacheHit = true,
            sourceUrl = metadata.sourceUrl,
            cachedAt = metadata.cachedAt ?: Files.getLastModifiedTime(metadataPath).toInstant(),
            contentType = metadata.contentType,
            localPhotoUrl = "/api/v1/aircraft/$normalizedIcao/photo/local",
        )
    }

    public fun exists(icao: String): Boolean = load(icao) != null

    public fun save(icao: String, photo: RemoteAircraftPhoto): Unit {
        val normalizedIcao = normalizeHex(icao) ?: return
        val metadata =
            StoredAircraftPhotoMetadata(
                icao = normalizedIcao,
                contentType = photo.contentType,
                sourceUrl = photo.sourceUrl,
                cachedAt = Instant.now(),
            )
        val imagePath = imagePath(normalizedIcao)
        val metadataPath = metadataPath(normalizedIcao)

        Files.write(
            imagePath,
            photo.bytes,
            StandardOpenOption.CREATE,
            StandardOpenOption.TRUNCATE_EXISTING,
            StandardOpenOption.WRITE,
        )
        Files.write(
            metadataPath,
            objectMapper.writeValueAsBytes(metadata),
            StandardOpenOption.CREATE,
            StandardOpenOption.TRUNCATE_EXISTING,
            StandardOpenOption.WRITE,
        )

        val now = FileTime.from(Instant.now())
        Files.setLastModifiedTime(imagePath, now)
        Files.setLastModifiedTime(metadataPath, now)
    }

    public fun prune(maxAge: Duration, maxEntries: Int): Int {
        val entries = listEntries()
        val cutoff = Instant.now().minus(maxAge)
        var removed = 0

        entries
            .filter { it.lastModified.isBefore(cutoff) || !it.isComplete }
            .forEach { entry ->
                deleteEntry(entry)
                removed += 1
            }

        if (maxEntries <= 0) {
            return removed
        }

        val remaining = listEntries()
            .filter { it.isComplete }
            .sortedByDescending { it.lastModified }

        remaining
            .drop(maxEntries)
            .forEach { entry ->
                deleteEntry(entry)
                removed += 1
            }

        return removed
    }

    private fun listEntries(): List<ArchiveEntry> {
        if (!Files.exists(rootPath)) {
            return emptyList()
        }

        val names = Files.list(rootPath).use { paths ->
            paths
                .map { it.fileName.toString() }
                .filter { it.endsWith(".bin") || it.endsWith(".json") }
                .map { it.substringBeforeLast('.') }
                .distinct()
                .toList()
        }

        return names.mapNotNull { name ->
            val normalizedIcao = normalizeHex(name) ?: return@mapNotNull null
            val imagePath = imagePath(normalizedIcao)
            val metadataPath = metadataPath(normalizedIcao)
            val imageExists = Files.exists(imagePath)
            val metadataExists = Files.exists(metadataPath)
            val lastModified =
                listOf(imagePath, metadataPath)
                    .filter(Files::exists)
                    .maxOfOrNull { Files.getLastModifiedTime(it).toInstant() }
                    ?: Instant.EPOCH

            ArchiveEntry(
                icao = normalizedIcao,
                imagePath = imagePath,
                metadataPath = metadataPath,
                isComplete = imageExists && metadataExists,
                lastModified = lastModified,
            )
        }
    }

    private fun deleteEntry(entry: ArchiveEntry): Unit {
        Files.deleteIfExists(entry.imagePath)
        Files.deleteIfExists(entry.metadataPath)
    }

    private fun imagePath(icao: String): Path = rootPath.resolve("$icao.bin")

    private fun metadataPath(icao: String): Path = rootPath.resolve("$icao.json")

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

    private data class ArchiveEntry(
        val icao: String,
        val imagePath: Path,
        val metadataPath: Path,
        val isComplete: Boolean,
        val lastModified: Instant,
    )

    private companion object {
        private const val ICAO_HEX_LENGTH: Int = 6
    }
}
