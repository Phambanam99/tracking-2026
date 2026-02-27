package com.tracking.broadcaster.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.broadcaster.spatial.SpatialPushEngine
import com.tracking.broadcaster.tracing.BroadcasterTraceContextExtractor
import com.tracking.broadcaster.tracing.BroadcasterTraceContextHolder
import com.tracking.common.dto.EnrichedFlight
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
public class LiveFlightConsumer(
    private val objectMapper: ObjectMapper,
    private val spatialPushEngine: SpatialPushEngine,
) {
    private val logger = LoggerFactory.getLogger(LiveFlightConsumer::class.java)

    @KafkaListener(
        topics = ["\${tracking.kafka.topics.live:live-adsb}"],
        groupId = "\${tracking.broadcaster.consumer.group-id:\${spring.application.name}-v1}",
        containerFactory = "broadcasterKafkaListenerContainerFactory",
    )
    public fun consume(record: ConsumerRecord<String, String>): Unit {
        val traceContext = BroadcasterTraceContextExtractor.extract(record)
        BroadcasterTraceContextHolder.withContext(traceContext) {
            val flight = runCatching { objectMapper.readValue(record.value(), EnrichedFlight::class.java) }
                .getOrElse { error ->
                    logger.warn("Ignore malformed flight payload from live topic", error)
                    return@withContext
                }

            if (flight.isHistorical) {
                logger.debug("Ignore historical flight from live topic: icao={}", flight.icao)
                return@withContext
            }

            spatialPushEngine.pushToMatchingSessions(flight)
        }
    }
}
