package com.tracking.processing.enrich

import com.tracking.common.dto.AircraftMetadata
import org.slf4j.LoggerFactory
import java.io.InputStream

/**
 * Loads [AircraftMetadata] reference data from a CSV file.
 *
 * Expected CSV format (UTF-8, comma-separated, with header row):
 * ```
 * icao,registration,aircraftType,operator,countryCode,countryFlagUrl,imageUrl
 * 888001,VN-A321,A321,Vietnam Airlines,VN,https://flagcdn.com/h80/vn.png,
 * ```
 *
 * Empty fields are treated as `null`. Lines starting with `#` are ignored.
 *
 * @param streamProvider A lambda that returns an [InputStream] to read from,
 *   or `null` if the resource is unavailable. Called once per [load] invocation.
 */
public class CsvReferenceDataLoader(
    private val streamProvider: () -> InputStream?,
) : ReferenceDataLoader {

    private val log = LoggerFactory.getLogger(CsvReferenceDataLoader::class.java)

    override fun load(): Map<String, AircraftMetadata> {
        val stream = streamProvider() ?: run {
            log.info("Aircraft reference CSV not found – enrichment cache will be empty")
            return emptyMap()
        }
        return stream.bufferedReader(Charsets.UTF_8).use { reader ->
            val result = mutableMapOf<String, AircraftMetadata>()
            var lineNo = 0
            for (raw in reader.lineSequence()) {
                lineNo++
                val line = raw.trim()
                if (line.isEmpty() || line.startsWith('#')) continue
                // Skip header row
                if (lineNo == 1 && line.startsWith("icao", ignoreCase = true)) continue
                val cols = line.split(',')
                if (cols.size < COLUMN_COUNT) {
                    log.warn("Skipping malformed CSV line {}: '{}'", lineNo, line)
                    continue
                }
                val icao = cols[COL_ICAO].trim().uppercase()
                if (icao.length != ICAO_HEX_LENGTH) continue
                val metadata =
                    AircraftMetadata(
                        registration = cols[COL_REGISTRATION].trim().ifEmpty { null },
                        aircraftType = cols[COL_AIRCRAFT_TYPE].trim().ifEmpty { null },
                        operator = cols[COL_OPERATOR].trim().ifEmpty { null },
                        countryCode = cols[COL_COUNTRY_CODE].trim().ifEmpty { null },
                        countryFlagUrl = cols[COL_COUNTRY_FLAG_URL].trim().ifEmpty { null },
                        imageUrl = cols.getOrNull(COL_IMAGE_URL)?.trim()?.ifEmpty { null },
                    )
                result[icao] = metadata
            }
            log.info("Loaded {} aircraft entries from reference CSV", result.size)
            result.toMap()
        }
    }

    private companion object {
        private const val ICAO_HEX_LENGTH = 6
        private const val COLUMN_COUNT = 6
        private const val COL_ICAO = 0
        private const val COL_REGISTRATION = 1
        private const val COL_AIRCRAFT_TYPE = 2
        private const val COL_OPERATOR = 3
        private const val COL_COUNTRY_CODE = 4
        private const val COL_COUNTRY_FLAG_URL = 5
        private const val COL_IMAGE_URL = 6
    }
}
