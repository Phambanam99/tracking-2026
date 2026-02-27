package com.tracking.ingestion.security

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.ingestion.metrics.IngestionMetrics
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
public class ApiKeyRevocationConsumer(
    private val objectMapper: ObjectMapper,
    private val apiKeyCacheService: ApiKeyCacheService,
    private val ingestionMetrics: IngestionMetrics,
) {
    private val logger = LoggerFactory.getLogger(ApiKeyRevocationConsumer::class.java)

    @KafkaListener(
        topics = ["\${tracking.kafka.topics.authRevocation:auth-revocation}"],
        groupId = "\${tracking.kafka.consumer.auth-revocation-group:\${spring.application.name}-\${random.uuid}}",
    )
    public fun consume(payload: String) {
        val event = runCatching { objectMapper.readValue(payload, RevocationEvent::class.java) }
            .getOrElse { error ->
                logger.warn("Ignore malformed revocation payload: payload={}", payload, error)
                return
            }

        if (event.type != TYPE_API_KEY_REVOKED) {
            return
        }

        val sourceId = event.sourceId?.trim().orEmpty()
        if (sourceId.isEmpty()) {
            return
        }

        apiKeyCacheService.revokeSourceId(sourceId)
        ingestionMetrics.incrementRevocationApplied()
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class RevocationEvent(
        val type: String = "",
        val sourceId: String? = null,
    )

    private companion object {
        private const val TYPE_API_KEY_REVOKED: String = "API_KEY_REVOKED"
    }
}
