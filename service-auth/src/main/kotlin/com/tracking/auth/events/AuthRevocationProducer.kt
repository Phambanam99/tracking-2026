package com.tracking.auth.events

import com.fasterxml.jackson.databind.ObjectMapper
import java.time.Instant
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component

@Component
public class AuthRevocationProducer(
        private val kafkaTemplate: KafkaTemplate<String, String>,
        private val objectMapper: ObjectMapper,
        @Value("\${tracking.kafka.topics.authRevocation:auth-revocation}")
        private val authRevocationTopic: String,
) {
    private val log = LoggerFactory.getLogger(AuthRevocationProducer::class.java)

    public fun publishApiKeyRevoked(id: Long, sourceId: String) {
        publishEvent(
                key = "api-key:$id",
                payload =
                        objectMapper.writeValueAsString(
                                mapOf(
                                        "type" to "API_KEY_REVOKED",
                                        "id" to id,
                                        "sourceId" to sourceId,
                                        "timestamp" to Instant.now().toString(),
                                ),
                        ),
        )
    }

    public fun publishUserTokensRevoked(username: String, reason: String) {
        publishEvent(
                key = "user:$username",
                payload =
                        objectMapper.writeValueAsString(
                                mapOf(
                                        "type" to "USER_TOKENS_REVOKED",
                                        "username" to username,
                                        "reason" to reason,
                                        "timestamp" to Instant.now().toString(),
                                ),
                        ),
        )
    }

    private fun publishEvent(key: String, payload: String) {
        kafkaTemplate.send(authRevocationTopic, key, payload).whenComplete { result, exception ->
            if (exception != null) {
                log.error(
                        "Failed to publish auth revocation event asynchronously: topic={}, key={}",
                        authRevocationTopic,
                        key,
                        exception
                )
            } else {
                log.debug(
                        "Successfully published auth revocation event: topic={}, key={}",
                        authRevocationTopic,
                        key
                )
            }
        }
    }
}
