package com.tracking.processing.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.CanonicalFlight
import com.tracking.processing.dedup.DedupCacheConfig
import com.tracking.processing.dedup.DedupKeyService
import com.tracking.processing.engine.FlightProcessor
import com.tracking.processing.engine.FlightStateFusionEngine
import com.tracking.processing.enrich.FlightEnricher
import com.tracking.processing.enrich.IcaoCountryResolver
import com.tracking.processing.enrich.AircraftPhotoProvider
import com.tracking.processing.enrich.NoopAircraftPhotoProvider
import com.tracking.processing.enrich.PlanespottersPhotoProvider
import com.tracking.processing.enrich.ReferenceDataCache
import com.tracking.processing.enrich.ReferenceDataLoader
import com.tracking.processing.eventtime.EventTimeResolver
import com.tracking.processing.metrics.ProcessingMetrics
import com.tracking.processing.routing.TopicRouter
import com.tracking.processing.state.LastKnownStateStore
import com.tracking.processing.tracing.KafkaTraceContextExtractor
import com.tracking.processing.tracing.ProcessingTraceContext
import com.tracking.processing.tracing.TraceContextHolder
import com.tracking.processing.validation.KinematicValidator
import java.time.Duration
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.kafka.listener.DefaultErrorHandler
import org.springframework.stereotype.Component
import org.springframework.util.backoff.FixedBackOff

@Configuration
public class ProcessingConsumerConfig {
    @Bean
    public fun dedupKeyService(): DedupKeyService = DedupKeyService()

    @Bean
    public fun dedupCacheConfig(
        @Value("\${tracking.processing.dedup.ttl-seconds:2}")
        dedupTtlSeconds: Long,
        @Value("\${tracking.processing.dedup.max-size:1000000}")
        dedupMaxSize: Long,
    ): DedupCacheConfig = DedupCacheConfig(ttl = Duration.ofSeconds(dedupTtlSeconds), maxSize = dedupMaxSize)

    @Bean
    public fun eventTimeResolver(): EventTimeResolver = EventTimeResolver()

    @Bean
    public fun lastKnownStateStore(
        @Value("\${tracking.processing.state.max-size:200000}")
        stateMaxSize: Long,
        @Value("\${tracking.processing.state.ttl-hours:2}")
        stateTtlHours: Long,
    ): LastKnownStateStore = LastKnownStateStore(maxSize = stateMaxSize, ttl = Duration.ofHours(stateTtlHours))

    @Bean
    public fun kinematicValidator(
        @Value("\${tracking.validation.max-speed-kmh:1200.0}")
        maxSpeedKmh: Double,
    ): KinematicValidator = KinematicValidator(maxSpeedKmh = maxSpeedKmh)

    @Bean
    public fun referenceDataLoader(): ReferenceDataLoader = ReferenceDataLoader { emptyMap() }

    @Bean
    public fun referenceDataCache(
        loader: ReferenceDataLoader,
        @Value("\${tracking.processing.enrichment.refresh-interval-seconds:600}")
        refreshIntervalSeconds: Long,
    ): ReferenceDataCache = ReferenceDataCache(loader = loader, refreshInterval = Duration.ofSeconds(refreshIntervalSeconds))

    @Bean
    public fun icaoCountryResolver(
        @Value("\${tracking.processing.enrichment.image-url-template:https://images.planespotters.net/{icao}.jpg}")
        imageUrlTemplate: String,
    ): IcaoCountryResolver = IcaoCountryResolver(imageUrlTemplate = imageUrlTemplate)

    @Bean
    public fun aircraftPhotoProvider(
        objectMapper: ObjectMapper,
        @Value("\${tracking.processing.enrichment.planespotters.enabled:true}")
        enabled: Boolean,
        @Value("\${tracking.processing.enrichment.planespotters.base-url:https://api.planespotters.net/pub/photos/hex}")
        baseUrl: String,
        @Value("\${tracking.processing.enrichment.planespotters.timeout-millis:700}")
        timeoutMillis: Long,
        @Value("\${tracking.processing.enrichment.planespotters.cache-ttl-minutes:30}")
        cacheTtlMinutes: Long,
        @Value("\${tracking.processing.enrichment.planespotters.cache-max-size:100000}")
        cacheMaxSize: Long,
    ): AircraftPhotoProvider {
        if (!enabled) {
            return NoopAircraftPhotoProvider
        }

        return PlanespottersPhotoProvider(
            objectMapper = objectMapper,
            apiBaseUrl = baseUrl,
            requestTimeout = Duration.ofMillis(timeoutMillis),
            cacheTtl = Duration.ofMinutes(cacheTtlMinutes),
            cacheMaxSize = cacheMaxSize,
        )
    }

    @Bean
    public fun flightEnricher(
        cache: ReferenceDataCache,
        icaoCountryResolver: IcaoCountryResolver,
        aircraftPhotoProvider: AircraftPhotoProvider,
    ): FlightEnricher =
        FlightEnricher(
            referenceDataCache = cache,
            icaoCountryResolver = icaoCountryResolver,
            aircraftPhotoProvider = aircraftPhotoProvider,
        )

    @Bean
    public fun topicRouter(
        @Value("\${tracking.kafka.topics.live:${TopicRouter.LIVE_TOPIC}}")
        liveTopic: String,
        @Value("\${tracking.kafka.topics.historical:${TopicRouter.HISTORICAL_TOPIC}}")
        historicalTopic: String,
    ): TopicRouter = TopicRouter(liveTopic = liveTopic, historicalTopic = historicalTopic)

    @Bean
    public fun processingErrorHandler(
        @Value("\${tracking.processing.consumer.retry.backoff-millis:1000}")
        retryBackoffMillis: Long,
        @Value("\${tracking.processing.consumer.retry.max-attempts:3}")
        maxRetryAttempts: Long,
    ): DefaultErrorHandler = DefaultErrorHandler(FixedBackOff(retryBackoffMillis, maxRetryAttempts))

    @Bean
    public fun flightStateFusionEngine(
        dedupKeyService: DedupKeyService,
        dedupCacheConfig: DedupCacheConfig,
        eventTimeResolver: EventTimeResolver,
        lastKnownStateStore: LastKnownStateStore,
        kinematicValidator: KinematicValidator,
        flightEnricher: FlightEnricher,
        topicRouter: TopicRouter,
        processingProducer: ProcessingProducer,
        invalidRecordDlqProducer: InvalidRecordDlqProducer,
        processingMetrics: ProcessingMetrics,
    ): FlightStateFusionEngine =
        FlightStateFusionEngine(
            dedupKeyService = dedupKeyService,
            dedupCacheConfig = dedupCacheConfig,
            eventTimeResolver = eventTimeResolver,
            lastKnownStateStore = lastKnownStateStore,
            kinematicValidator = kinematicValidator,
            flightEnricher = flightEnricher,
            topicRouter = topicRouter,
            processingProducer = processingProducer,
            invalidRecordDlqProducer = invalidRecordDlqProducer,
            processingMetrics = processingMetrics,
        )
}

@Component
public class RawAdsbConsumer(
    private val objectMapper: ObjectMapper,
    private val flightProcessor: FlightProcessor,
    private val invalidRecordDlqProducer: InvalidRecordDlqProducer,
    private val processingMetrics: ProcessingMetrics,
    @Value("\${tracking.processing.consumer.strict-key-match:true}")
    private val strictKeyMatch: Boolean = true,
) {
    private val logger = LoggerFactory.getLogger(RawAdsbConsumer::class.java)

    @KafkaListener(
        topics = ["\${tracking.kafka.topics.raw:raw-adsb}"],
        groupId = "\${tracking.processing.consumer.group-id:\${spring.application.name}-v1}",
    )
    public fun consume(record: ConsumerRecord<String, String>): Unit {
        consume(
            key = record.key(),
            payload = record.value(),
            traceContext = KafkaTraceContextExtractor.extract(record),
        )
    }

    public fun consume(
        key: String?,
        payload: String,
        traceContext: ProcessingTraceContext = ProcessingTraceContext(),
    ): Unit {
        processingMetrics.incrementRawConsumed()

        TraceContextHolder.withContext(traceContext) {
            val flight = runCatching { objectMapper.readValue(payload, CanonicalFlight::class.java) }
                .getOrElse { error ->
                    processingMetrics.incrementMalformedPayload()
                    logger.warn("Ignore malformed payload from raw topic: payload={}", payload, error)
                    return@withContext
                }

            if (strictKeyMatch && key != null && key.isNotBlank() && key != flight.icao) {
                processingMetrics.incrementKeyMismatch()
                invalidRecordDlqProducer.publish(
                    InvalidFlightRecord(
                        reason = KEY_ICAO_MISMATCH_REASON,
                        flight = flight,
                    ),
                )
                return@withContext
            }

            flightProcessor.process(flight)
        }
    }

    private companion object {
        private const val KEY_ICAO_MISMATCH_REASON: String = "KEY_ICAO_MISMATCH"
    }
}
