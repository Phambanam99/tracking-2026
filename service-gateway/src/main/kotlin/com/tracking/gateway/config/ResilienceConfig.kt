package com.tracking.gateway.config

import io.netty.channel.ChannelOption
import io.netty.handler.timeout.ReadTimeoutHandler
import io.netty.handler.timeout.WriteTimeoutHandler
import java.time.Duration
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.cloud.client.circuitbreaker.ReactiveCircuitBreaker
import org.springframework.cloud.client.circuitbreaker.ReactiveCircuitBreakerFactory
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.reactive.ReactorClientHttpConnector
import org.springframework.web.reactive.function.client.WebClient
import reactor.netty.http.client.HttpClient

@Configuration
public class ResilienceConfig {
    @Bean("authWebClient")
    public fun authWebClient(
        builder: WebClient.Builder,
        properties: GatewayResilienceProperties,
    ): WebClient {
        val httpClient = HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, properties.connectTimeoutMillis)
            .responseTimeout(Duration.ofMillis(properties.responseTimeoutMillis))
            .doOnConnected { connection ->
                connection.addHandlerLast(ReadTimeoutHandler(properties.readTimeoutMillis.toLong(), java.util.concurrent.TimeUnit.MILLISECONDS))
                connection.addHandlerLast(WriteTimeoutHandler(properties.writeTimeoutMillis.toLong(), java.util.concurrent.TimeUnit.MILLISECONDS))
            }

        return builder
            .clientConnector(ReactorClientHttpConnector(httpClient))
            .build()
    }

    @Bean("jwksCircuitBreaker")
    public fun jwksCircuitBreaker(
        factory: ReactiveCircuitBreakerFactory<*, *>,
        properties: GatewayResilienceProperties,
    ): ReactiveCircuitBreaker {
        return factory.create(properties.jwksCircuitBreakerName)
    }

    @Bean("apiKeyCircuitBreaker")
    public fun apiKeyCircuitBreaker(
        factory: ReactiveCircuitBreakerFactory<*, *>,
        properties: GatewayResilienceProperties,
    ): ReactiveCircuitBreaker {
        return factory.create(properties.apiKeyCircuitBreakerName)
    }
}

@ConfigurationProperties(prefix = "tracking.gateway.resilience")
public class GatewayResilienceProperties(
    public var connectTimeoutMillis: Int = 750,
    public var responseTimeoutMillis: Long = 1500,
    public var readTimeoutMillis: Int = 1500,
    public var writeTimeoutMillis: Int = 1500,
    public var jwksCallTimeoutMillis: Long = 1200,
    public var apiKeyCallTimeoutMillis: Long = 300,
    public var jwksCircuitBreakerName: String = "auth-jwks",
    public var apiKeyCircuitBreakerName: String = "auth-api-key",
)
