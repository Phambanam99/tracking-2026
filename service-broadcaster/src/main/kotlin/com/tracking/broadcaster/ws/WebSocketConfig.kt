package com.tracking.broadcaster.ws

import com.tracking.broadcaster.config.BroadcasterProperties
import org.springframework.context.annotation.Configuration
import org.springframework.messaging.simp.config.ChannelRegistration
import org.springframework.messaging.simp.config.MessageBrokerRegistry
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker
import org.springframework.web.socket.config.annotation.StompEndpointRegistry
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig(
    private val jwtChannelInterceptor: JwtChannelInterceptor,
    private val broadcasterProperties: BroadcasterProperties,
) : WebSocketMessageBrokerConfigurer {
    override fun registerStompEndpoints(registry: StompEndpointRegistry): Unit {
        registry.addEndpoint("/ws/live")
            .setAllowedOriginPatterns(*broadcasterProperties.ws.allowedOriginPatterns.toTypedArray())
    }

    override fun configureMessageBroker(registry: MessageBrokerRegistry): Unit {
        registry.enableSimpleBroker("/topic")
        registry.setApplicationDestinationPrefixes("/app")
        registry.setUserDestinationPrefix("/user")
    }

    override fun configureClientInboundChannel(registration: ChannelRegistration): Unit {
        registration.interceptors(jwtChannelInterceptor)
    }
}
