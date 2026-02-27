package com.tracking.broadcaster.security

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.databind.ObjectMapper
import java.time.Instant
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
public class BroadcasterRevocationConsumer(
    private val objectMapper: ObjectMapper,
    private val blacklistService: BroadcasterBlacklistService,
) {
    private val logger = LoggerFactory.getLogger(BroadcasterRevocationConsumer::class.java)

    @KafkaListener(
        topics = ["\${tracking.kafka.topics.authRevocation:auth-revocation}"],
        groupId = "\${tracking.broadcaster.consumer.auth-revocation-group:\${spring.application.name}-\${random.uuid}}",
    )
    public fun consume(payload: String): Unit {
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

            TYPE_TOKEN_REVOKED -> {
                val tokenId = event.tokenId?.takeIf { it.isNotBlank() } ?: return
                val expiresAt = event.expiresAtEpochMillis?.let(Instant::ofEpochMilli) ?: Instant.now().plusSeconds(60)
                blacklistService.revokeTokenId(tokenId, expiresAt)
            }

            else -> logger.debug("Ignore unknown revocation event type={}", event.type)
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class RevocationEvent(
        val type: String = "",
        val username: String? = null,
        val tokenId: String? = null,
        val expiresAtEpochMillis: Long? = null,
    )

    private companion object {
        private const val TYPE_USER_TOKENS_REVOKED: String = "USER_TOKENS_REVOKED"
        private const val TYPE_TOKEN_REVOKED: String = "TOKEN_REVOKED"
    }
}
