package com.tracking.query.cache

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.EnrichedFlight
import com.tracking.query.photo.AircraftPhotoCacheService
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.geo.Point
import org.springframework.data.redis.connection.RedisGeoCommands
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

/**
 * Subscribes to [topic] and writes each [EnrichedFlight] into Redis as a hash.
 *
 * Data model per aircraft:
 * ```
 * KEY:  aircraft:<ICAO>   (TTL = ttlSeconds)
 * HASH: icao, lat, lon, altitude, speed, heading, event_time,
 *       source_id, registration, aircraft_type, operator, country_code
 *
 * SET:  aircraft:index    (all active ICAO codes, no TTL — cleaned by StaleIndexCleaner)
 * ```
 */
@Component
public class LiveAircraftCacheWriter(
    private val redisTemplate: StringRedisTemplate,
    private val objectMapper: ObjectMapper,
    private val aircraftPhotoCacheService: AircraftPhotoCacheService,
    @Value("\${tracking.query.live-cache.ttl-seconds:300}")
    private val ttlSeconds: Long,
    @Value("\${tracking.query.live-cache.key-prefix:aircraft:}")
    private val keyPrefix: String,
    @Value("\${tracking.query.live-cache.index-key:aircraft:index}")
    private val indexKey: String,
    @Value("\${tracking.query.live-cache.geo-key:aircraft:geo}")
    private val geoKey: String,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @KafkaListener(topics = ["\${tracking.query.live-cache.topic:live-adsb}"])
    public fun onLiveFlight(record: ConsumerRecord<String, String>) {
        try {
            val flight = objectMapper.readValue(record.value(), EnrichedFlight::class.java)
            val key = "$keyPrefix${flight.icao}"

            val fields = mutableMapOf(
                "icao" to flight.icao,
                "lat" to flight.lat.toString(),
                "lon" to flight.lon.toString(),
                "event_time" to flight.eventTime.toString(),
                "source_id" to flight.sourceId,
            )
            flight.altitude?.let { fields["altitude"] = it.toString() }
            flight.speed?.let { fields["speed"] = it.toString() }
            flight.heading?.let { fields["heading"] = it.toString() }
            flight.metadata?.let { meta ->
                meta.registration?.let { fields["registration"] = it }
                meta.aircraftType?.let { fields["aircraft_type"] = it }
                meta.operator?.let { fields["operator"] = it }
                meta.countryCode?.let { fields["country_code"] = it }
            }

            // Pipeline: HSET + EXPIRE + SADD — one round-trip
            redisTemplate.executePipelined { connection ->
                val keyBytes = key.toByteArray()
                connection.hashCommands().hMSet(
                    keyBytes,
                    fields.entries.associate { it.key.toByteArray() to it.value.toByteArray() },
                )
                connection.keyCommands().expire(keyBytes, ttlSeconds)
                connection.setCommands().sAdd(indexKey.toByteArray(), flight.icao.toByteArray())
                connection.geoCommands().geoAdd(
                    geoKey.toByteArray()