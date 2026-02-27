package com.tracking.gateway.security

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
public class RevocationKafkaConsumer(
    private val objectMapper: ObjectMapper,
    private val blacklistService: BlacklistService,
) {
    private val logger = LoggerFactory.getLogger(RevocationKafkaConsumer::class.java)

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

        when (event.type) {
            TYPE_USER_TOKENS_REVOKED -> {
                val username = event.username?.takeIf { it.isNotBlank() } ?: return
                blacklistService.revokeUsername(username)
            }

            TYPE_API_KEY_REVOKED -> {
                val sourceId = event.sourceId?.takeIf { it.isNotBlank() } ?: return
                blacklistService.revokeSourceId(sourceId)
            }

            else -> logger.debug("Ignore unknown revocation event type={}", event.type)
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class RevocationEvent(
        val type: String = "",
        val username: String? = null,
        val sourceId: String? = null,
    )

    private companion object {
        private const val TYPE_USER_TOKENS_REVOKED: String = "USER_TOKENS_REVOKED"
        private const val TYPE_API_KEY_REVOKED: String = "API_KEY_REVOKED"
    }
}
