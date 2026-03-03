package com.tracking.broadcaster.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.broadcaster.spatial.ShipSpatialPushEngine
import com.tracking.broadcaster.tracing.BroadcasterTraceContextExtractor
import com.tracking.broadcaster.tracing.BroadcasterTraceContextHolder
import com.tracking.common.dto.EnrichedShip
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
@ConditionalOnProperty(prefix = "tracking.broadcaster.ship", name = ["consumer-enabled"], havingValue = "true")
public class LiveShipConsumer(
    private val objectMapper: ObjectMapper,
    private val spatialPushEngine: ShipSpatialPushEngine,
) {
    private val logger = LoggerFactory.getLogger(LiveShipConsumer::class.java)

    @KafkaListener(
        topics = ["\${tracking.kafka.topics.liveAis:live-ais}"],
        groupId = "\${tracking.broadcaster.consumer.group-id:\${spring.application.name}-v1}-ship",
        containerFactory = "broadcasterKafkaListenerContainerFactory",
    )
    public fun consume(record: ConsumerRecord<String, String>): Unit {
        val traceContext = BroadcasterTraceContextExtractor.extract(record)
        BroadcasterTraceContextHolder.withContext(traceContext) {
            val ship = runCatching { objectMapper.readValue(record.value(), EnrichedShip::class.java) }
                .getOrElse { error ->
                    logger.warn("Ignore malformed ship payload from live topic", error)
                    return@withContext
                }

            if (ship.isHistorical) {
                logger.debug("Ignore historical ship from live topic: mmsi={}", ship.mmsi)
                return@withContext
            }

            spatialPushEngine.pushToMatchingSessions(ship)
        }
    }
}
