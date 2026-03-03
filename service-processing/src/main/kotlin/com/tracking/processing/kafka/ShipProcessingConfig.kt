package com.tracking.processing.kafka

import com.tracking.processing.dedup.DedupCacheConfig
import com.tracking.processing.dedup.ShipDedupKeyService
import com.tracking.processing.engine.ShipProcessor
import com.tracking.processing.engine.ShipStateFusionEngine
import com.tracking.processing.enrich.ShipEnricher
import com.tracking.processing.eventtime.EventTimeResolver
import com.tracking.processing.metrics.ProcessingMetrics
import com.tracking.processing.routing.ShipTopicRouter
import com.tracking.processing.state.ShipLastKnownStateStore
import com.tracking.processing.validation.ShipKinematicValidator
import java.time.Duration
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
@ConditionalOnProperty(prefix = "tracking.processing.ship", name = ["consumer-enabled"], havingValue = "true")
public class ShipProcessingConfig {
    @Bean
    public fun shipDedupKeyService(): ShipDedupKeyService = ShipDedupKeyService()

    @Bean(name = ["shipDedupCacheConfig"])
    public fun shipDedupCacheConfig(
        @Value("\${tracking.processing.ship.dedup-ttl-seconds:2}")
        dedupTtlSeconds: Long,
        @Value("\${tracking.processing.dedup.max-size:1000000}")
        dedupMaxSize: Long,
    ): DedupCacheConfig = DedupCacheConfig(ttl = Duration.ofSeconds(dedupTtlSeconds), maxSize = dedupMaxSize)

    @Bean
    public fun shipLastKnownStateStore(
        @Value("\${tracking.processing.state.max-size:200000}")
        stateMaxSize: Long,
        @Value("\${tracking.processing.ship.state-ttl-hours:2}")
        stateTtlHours: Long,
    ): ShipLastKnownStateStore = ShipLastKnownStateStore(maxSize = stateMaxSize, ttl = Duration.ofHours(stateTtlHours))

    @Bean
    public fun shipKinematicValidator(
        @Value("\${tracking.processing.ship.max-speed-kmh:120.0}")
        maxSpeedKmh: Double,
    ): ShipKinematicValidator = ShipKinematicValidator(maxSpeedKmh = maxSpeedKmh)

    @Bean
    public fun shipEnricher(): ShipEnricher = ShipEnricher()

    @Bean
    public fun shipTopicRouter(
        @Value("\${tracking.kafka.topics.liveAis:${ShipTopicRouter.LIVE_TOPIC}}")
        liveTopic: String,
        @Value("\${tracking.kafka.topics.historicalAis:${ShipTopicRouter.HISTORICAL_TOPIC}}")
        historicalTopic: String,
    ): ShipTopicRouter = ShipTopicRouter(liveTopic = liveTopic, historicalTopic = historicalTopic)

    @Bean
    public fun shipStateFusionEngine(
        dedupKeyService: ShipDedupKeyService,
        @Qualifier("shipDedupCacheConfig")
        dedupCacheConfig: DedupCacheConfig,
        eventTimeResolver: EventTimeResolver,
        lastKnownStateStore: ShipLastKnownStateStore,
        kinematicValidator: ShipKinematicValidator,
        shipEnricher: ShipEnricher,
        topicRouter: ShipTopicRouter,
        processingProducer: ShipProcessingProducer,
        invalidRecordDlqProducer: ShipInvalidRecordDlqProducer,
        processingMetrics: ProcessingMetrics,
    ): ShipStateFusionEngine =
        ShipStateFusionEngine(
            dedupKeyService = dedupKeyService,
            dedupCacheConfig = dedupCacheConfig,
            eventTimeResolver = eventTimeResolver,
            lastKnownStateStore = lastKnownStateStore,
            kinematicValidator = kinematicValidator,
            shipEnricher = shipEnricher,
            topicRouter = topicRouter,
            processingProducer = processingProducer,
            invalidRecordDlqProducer = invalidRecordDlqProducer,
            processingMetrics = processingMetrics,
        )

    @Bean
    public fun shipProcessor(shipStateFusionEngine: ShipStateFusionEngine): ShipProcessor = shipStateFusionEngine
}
