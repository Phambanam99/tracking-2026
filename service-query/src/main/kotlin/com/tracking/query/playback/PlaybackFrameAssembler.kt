package com.tracking.query.playback

import com.tracking.query.dto.PlaybackAircraftDto
import com.tracking.query.dto.PlaybackFrameDto
import org.springframework.stereotype.Component

@Component
public class PlaybackFrameAssembler {
    public fun assemble(rows: List<PlaybackQueryRow>): List<PlaybackFrameDto> {
        if (rows.isEmpty()) {
            return emptyList()
        }

        val frameMap = linkedMapOf<Long, MutableMap<String, PlaybackAircraftDto>>()

        for (row in rows) {
            val aircraftMapForBucket = frameMap.getOrPut(row.bucketTimeMs) { linkedMapOf() }
            val current = aircraftMapForBucket[row.icao]

            if (current == null || row.eventTimeMs >= current.eventTime) {
                aircraftMapForBucket[row.icao] = PlaybackAircraftDto(
                    icao = row.icao,
                    lat = row.lat,
                    lon = row.lon,
                    altitude = row.altitude,
                    speed = row.speed,
                    heading = row.heading,
                    eventTime = row.eventTimeMs,
                    sourceId = row.sourceId,
                    registration = row.registration,
                    aircraftType = row.aircraftType,
                    operator = row.operator,
                )
            }
        }

        return frameMap
            .entries
            .map { (timestamp, aircraftMap) ->
                PlaybackFrameDto(
                    timestamp = timestamp,
                    aircraft = aircraftMap.values.sortedBy { it.icao },
                )
            }
            .sortedBy { it.timestamp }
    }
}

public data class PlaybackQueryRow(
    val bucketTimeMs: Long,
    val icao: String,
    val lat: Double,
    val lon: Double,
    val altitude: Int?,
    val speed: Double?,
    val heading: Double?,
    val eventTimeMs: Long,
    val sourceId: String?,
    val registration: String?,
    val aircraftType: String?,
    val operator: String?,
)
