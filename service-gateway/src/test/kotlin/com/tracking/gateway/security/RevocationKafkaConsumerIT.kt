package com.tracking.gateway.security

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

public class RevocationKafkaConsumerIT {
    private val objectMapper: ObjectMapper = ObjectMapper()

    @Test
    public fun `should propagate user revocation to multiple gateway instances`() {
        val instanceOneBlacklist = BlacklistService(GatewaySecurityProperties())
        val instanceTwoBlacklist = BlacklistService(GatewaySecurityProperties())
        val consumerOne = RevocationKafkaConsumer(objectMapper, instanceOneBlacklist)
        val consumerTwo = RevocationKafkaConsumer(objectMapper, instanceTwoBlacklist)

        val event = objectMapper.writeValueAsString(
            mapOf(
                "type" to "USER_TOKENS_REVOKED",
                "username" to "alice",
            ),
        )

        consumerOne.consume(event)
        consumerTwo.consume(event)

        assertTrue(instanceOneBlacklist.isUserRevoked("alice"))
        assertTrue(instanceTwoBlacklist.isUserRevoked("alice"))
    }

    @Test
    public fun `should propagate api key source revocation`() {
        val blacklist = BlacklistService(GatewaySecurityProperties())
        val consumer = RevocationKafkaConsumer(objectMapper, blacklist)
        val event = objectMapper.writeValueAsString(
            mapOf(
                "type" to "API_KEY_REVOKED",
                "sourceId" to "SRC-889",
            ),
        )

        consumer.consume(event)

        assertTrue(blacklist.isApiKeyRevoked("not-same-key", "SRC-889"))
        assertFalse(blacklist.isApiKeyRevoked("not-same-key", "SRC-123"))
    }
}
