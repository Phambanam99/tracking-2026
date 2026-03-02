package com.tracking.processing.enrich

import java.io.InputStream
import org.slf4j.LoggerFactory

public class MilitaryHexResolver(
    militaryHexCodes: Set<String> = loadHexCodes(DEFAULT_RESOURCE_PATH),
) {
    private val militaryHexCodes: Set<String> = normalize(militaryHexCodes)
    internal val loadedCount: Int
        get() = militaryHexCodes.size

    public fun isMilitary(icao: String): Boolean = militaryHexCodes.contains(icao.lowercase())

    private companion object {
        private const val DEFAULT_RESOURCE_PATH: String = "/db/military-hex-db.js"
        private val logger = LoggerFactory.getLogger(MilitaryHexResolver::class.java)
        private val hexPattern = Regex("\"([0-9a-fA-F]{6})\"")

        private fun loadHexCodes(resourcePath: String): Set<String> {
            val resourceStream = MilitaryHexResolver::class.java.getResourceAsStream(resourcePath)
                ?: error("Military hex resource not found: $resourcePath")
            val loadedHexCodes = resourceStream.use(::parseHexCodes)
            logger.info("Loaded {} military ICAO hex entries from {}", loadedHexCodes.size, resourcePath)
            return loadedHexCodes
        }

        private fun parseHexCodes(inputStream: InputStream): Set<String> {
            val content = inputStream.bufferedReader().use { it.readText() }
            return normalize(hexPattern.findAll(content).map { it.groupValues[1] }.toSet())
        }

        private fun normalize(hexCodes: Set<String>): Set<String> = hexCodes.map { it.lowercase() }.toSet()
    }
}
