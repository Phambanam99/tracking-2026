package com.tracking.query.cache

import com.tracking.query.dto.SearchResult
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.geo.Distance
import org.springframework.data.geo.GeoResults
import org.springframework.data.geo.Metrics
import org.springframework.data.geo.Point
import org.springframework.data.redis.connection.RedisGeoCommands
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.domain.geo.BoundingBox
import org.springframework.data.redis.domain.geo.GeoReference
import org.springframework.stereotype.Component
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos

/**
 * Reads live aircraft data from Redis cache.
 *
 * Search strategy:
 * 1. `SMEMBERS aircraft:index` → all active ICAOs
 * 2. If query looks like a hex string, pre-filter ICAO list (cheap, no Redis calls)
 * 3. Pipeline `HGETALL` for candidates
 * 4. Text match on callsign/registration/type/operator fields
 */
@Component
public class LiveAircraftCacheReader(
    private val redisTemplate: StringRedisTemplate,
    private val aircraftReferenceLookup: AircraftReferenceLookup = NoopAircraftReferenceLookup,
    @Value("\${tracking.query.live-cache.key-prefix:aircraft:}")
    private val keyPrefix: String,
    @Value("\${tracking.query.live-cache.index-key:aircraft:index}")
    private val indexKey: String,
    @Value("\${tracking.query.live-cache.geo-key:aircraft:geo}")
    private val geoKey: String,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val hexPattern = Regex("^[0-9a-f]+$")

    public fun searchLive(query: String, maxResults: Int = 100): List<SearchResult> {
        val q = query.lowercase().trim()
        if (q.length < 2) return emptyList()

        val allIcaos = redisTemplate.opsForSet().members(indexKey) ?: return emptyList()

        // isHexQuery: if query is all hex chars, also try ICAO prefix match in addition to text fields
        val isHexQuery = hexPattern.matches(q)
        val results = mutableListOf<SearchResult>()
        val hashOps = redisTemplate.opsForHash<String, String>()

        for (icao in allIcaos) {
            if (results.size >= maxResults) break
            val icaoMatch = isHexQuery && icao.lowercase().contains(q)
            val hash = hashOps.entries("$keyPrefix$icao")
            if (hash.isEmpty()) continue
            if (icaoMatch || matchesQuery(hash, q)) {
                results.add(hashToSearchResult(hash))
            }
        }
        return results
    }

    public fun findInBoundingBox(
        north: Double,
        south: Double,
        east: Double,
        west: Double,
        maxResults: Int = 5000,
    ): List<SearchResult> {
        val center = Point((west + east) / 2.0, (south + north) / 2.0)
        val geoResults = redisTemplate.opsForGeo().search(
            geoKey,
            GeoReference.fromCoordinate(center),
            BoundingBox(
                Distance(bboxWidthKilometers(center.y, west, east), Metrics.KILOMETERS),
                Distance(bboxHeightKilometers(south, north), Metrics.KILOMETERS),
            ),
            RedisGeoCommands.GeoSearchCommandArgs.newGeoSearchArgs().limit(maxResults.toLong()),
        ) ?: return emptyList()

        val hashOps = redisTemplate.opsForHash<String, String>()
        val results = mutableListOf<SearchResult>()

        for (geoResult in geoResults.content) {
            val icao = geoResult.content.name ?: continue
            val hash = hashOps.entries("$keyPrefix$icao")
            if (hash.isEmpty()) continue

            val lat = hash["lat"]?.toDoubleOrNull() ?: continue
            val lon = hash["lon"]?.toDoubleOrNull() ?: continue
            if (lat !in south..north || lon !in west..east) {
                continue
            }

            results.add(hashToSearchResult(hash))
        }

        return results
    }

    private fun bboxWidthKilometers(centerLat: Double, west: Double, east: Double): Double {
        val lonDelta = abs(east - west)
        val kmPerDegreeLon = 111.320 * cos(centerLat * PI / 180.0)
        return (lonDelta * kmPerDegreeLon).coerceAtLeast(MIN_BOX_SIZE_KM)
    }

    private fun bboxHeightKilometers(south: Double, north: Double): Double =
        ((north - south) * 110.574).coerceAtLeast(MIN_BOX_SIZE_KM)

    private fun matchesQuery(hash: Map<String, String>, q: String): Boolean {
        val enriched = enrichedHash(hash)
        return enriched["icao"]?.lowercase()?.contains(q) == true ||
            enriched["registration"]?.lowercase()?.contains(q) == true ||
            enriched["aircraft_type"]?.lowercase()?.contains(q) == true ||
            enriched["operator"]?.lowercase()?.contains(q) == true
    }

    private fun hashToSearchResult(hash: Map<String, String>): SearchResult {
        val enriched = enrichedHash(hash)
        return SearchResult(
            icao = enriched["icao"] ?: "",
            lat = enriched["lat"]?.toDoubleOrNull() ?: 0.0,
            lon = enriched["lon"]?.toDoubleOrNull() ?: 0.0,
            altitude = enriched["altitude"]?.toIntOrNull(),
            speed = enriched["speed"]?.toDoubleOrNull(),
            heading = enriched["heading"]?.toDoubleOrNull(),
            eventTime = enriched["event_time"]?.toLongOrNull() ?: 0L,
            sourceId = enriched["source_id"],
            registration = enriched["registration"],
            aircraftType = enriched["aircraft_type"],
            operator = enriched["operator"],
            isMilitary = enriched["is_military"]?.toBooleanStrictOrNull() ?: false,
        )
    }

    private fun enrichedHash(hash: Map<String, String>): Map<String, String> {
        if (
            hash["registration"] != null &&
            hash["aircraft_type"] != null &&
            hash["operator"] != null
        ) {
            return hash
        }
        val icao = hash["icao"] ?: return hash
        val reference = aircraftReferenceLookup.findByIcao(icao) ?: return hash
        return buildMap(hash.size + 3) {
            putAll(hash)
            if (hash["registration"] == null) {
                reference.registration?.let { put("registration", it) }
            }
            if (hash["aircraft_type"] == null) {
                reference.aircraftType?.let { put("aircraft_type", it) }
            }
            if (hash["operator"] == null) {
                reference.operator?.let { put("operator", it) }
            }
        }
    }

    private companion object {
        private const val MIN_BOX_SIZE_KM: Double = 0.1
    }
}
