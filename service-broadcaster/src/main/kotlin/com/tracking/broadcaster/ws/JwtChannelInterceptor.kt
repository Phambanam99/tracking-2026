package com.tracking.broadcaster.ws

import com.tracking.broadcaster.metrics.BroadcasterMetrics
import com.tracking.broadcaster.security.BroadcasterBlacklistService
import com.tracking.broadcaster.security.BroadcasterJwtTokenVerifier
import org.springframework.messaging.Message
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.MessageDeliveryException
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.messaging.support.ChannelInterceptor
import org.springframework.messaging.support.MessageBuilder
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.stereotype.Component

@Component
public class JwtChannelInterceptor(
    private val jwtTokenVerifier: BroadcasterJwtTokenVerifier,
    private val blacklistService: BroadcasterBlacklistService,
    private val broadcasterMetrics: BroadcasterMetrics,
) : ChannelInterceptor {
    override fun preSend(message: Message<*>, channel: MessageChannel): Message<*>? {
        val accessor = StompHeaderAccessor.wrap(message)
        if (accessor.command != StompCommand.CONNECT) {
            return message
        }

        val token = extractBearerToken(accessor) ?: rejectConnect("Missing Authorization Bearer token")
        val principal = jwtTokenVerifier.verify(token) ?: rejectConnect("Invalid or expired JWT")

        if (blacklistService.isUserRevoked(principal.subject) || blacklistService.isTokenRevoked(principal.tokenId)) {
            rejectConnect("Revoked JWT principal")
        }

        val authentication = UsernamePasswordAuthenticationToken(
            principal.subject,
            null,
            principal.roles.map { role -> SimpleGrantedAuthority(role) },
        )
        accessor.user = authentication
        accessor.setLeaveMutable(true)
        return MessageBuilder.createMessage(message.payload, accessor.messageHeaders)
    }

    private fun extractBearerToken(accessor: StompHeaderAccessor): String? {
        val candidates = listOf("Authorization", "authorization")
        val header = candidates
            .asSequence()
            .mapNotNull { key -> accessor.getFirstNativeHeader(key) }
            .firstOrNull()
            ?.trim()
            .orEmpty()

        if (header.isBlank() || !header.startsWith(BEARER_PREFIX, ignoreCase = true)) {
            return null
        }

        return header.substring(BEARER_PREFIX.length).trim().takeIf { it.isNotBlank() }
    }

    private fun rejectConnect(message: String): Nothing {
        broadcasterMetrics.incrementRejectedJwt()
        throw MessageDeliveryException(message)
    }

    private companion object {
        private const val BEARER_PREFIX: String = "Bearer "
    }
}
