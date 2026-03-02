package com.tracking.query.cache

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.core.io.Resource
import org.springframework.stereotype.Component
import java.io.BufferedReader
import java.io.InputStreamReader
import java.nio.charset.StandardCharsets
import java.util.concurrent.atomic.AtomicReference

@Component
public class CsvAircraftReferenceLookup(
    @Value("\${tracking.query.reference.db-csv-path:classpath:db/aircraft.csv}")
    private val csvResource: Resource,
) : AircraftReferenceLookup {
    private val cache: AtomicReference<Map<String, AircraftReferenceMetadata>> = AtomicReference(load())

    override fun findByIcao(icao: String): AircraftReferenceMetadata? = cache.get()[icao.trim().uppercase()]

    private fun load(): Map<String, AircraftReferenceMetadata> {
        if (!csvResource.exists()) {
            log.warn("Aircraft reference CSV not found at {}", csvResource)
            return emptyMap()
        }

        return csvResource.inputStream.use { input ->
            BufferedReader(InputStreamReader(input, StandardCharsets.UTF_8)).use { reader ->
                val rows = linkedMapOf<String, AircraftReferenceMetadata>()
                val headerLine = reader.readLine() ?: return emptyMap()
                val delimiter = if (headerLine.contains(';')) ';' else ','
                val header = splitRow(headerLine, delimiter)

                if (delimiter == ';') {
                    reader.lineSequence()
                        .filter { it.isNotBlank() }
                        .forEach { line ->
                            val columns = splitRow(line, delimiter)
                            val icao = columns.getOrNull(0)?.trim()?.uppercase().orEmpty()
                            if (icao.isEmpty()) {
                                return@forEach
                            }
                            rows[icao] =
                                AircraftReferenceMetadata(
                                    registration = columns.getOrNull(1)?.trim()?.ifEmpty { null },
                                    aircraftType = columns.getOrNull(2)?.trim()?.uppercase()?.ifEmpty { null },
                                    operator = columns.getOrNull(6)?.trim()?.ifEmpty { null },
                                )
                        }
                } else {
                    val indices = header
                        .mapIndexed { index, name -> name.trim() to index }
                        .toMap()
                    reader.lineSequence()
                        .filter { it.isNotBlank() }
                        .forEach { line ->
                            val columns = splitRow(line, delimiter)
                            val icao = valueAt(columns, indices, "icao")?.uppercase().orEmpty()
                            if (icao.isEmpty()) {
                                return@forEach
                            }
                            rows[icao] =
                                AircraftReferenceMetadata(
                                    registration = valueAt(columns, indices, "registration"),
                                    aircraftType = valueAt(columns, indices, "aircraftType")?.uppercase(),
                                    operator = valueAt(columns, indices, "operator"),
                                )
                        }
                }

                log.info("Loaded {} aircraft reference entries for query backfill", rows.size)
                rows
            }
        }
    }

    private fun splitRow(line: String, delimiter: Char): List<String> = line.split(delimiter)

    private fun valueAt(
        columns: List<String>,
        indices: Map<String, Int>,
        key: String,
    ): String? = indices[key]?.let(columns::getOrNull)?.trim()?.ifEmpty { null }

    private companion object {
        private val log = LoggerFactory.getLogger(CsvAircraftReferenceLookup::class.java)
    }
}
