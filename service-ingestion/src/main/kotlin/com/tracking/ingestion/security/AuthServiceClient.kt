package com.tracking.ingestion.security

import com.tracking.ingestion.config.IngestionProperties
import java.time.Duration
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import reactor.core.publisher.Mono

@Component
public class AuthServiceClient(
    private val webClientBuilder: WebClient.Builder,
    private val ingestionProperties: IngestionProperties,
) {
    private val webClient: WebClient = webClientBuilder.build()

    public fun verifyApiKey(apiKey: String): Mono<ApiKeyPrincipal> {
        val securityProperties = ingestionProperties.security

        return webClient.post()
            .uri(securityProperties.authVerifyUri)
            .header(INTERNAL_API_KEY_HEADER, securityProperties.internalApiKey)
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(ApiKeyVerifyRequest(apiKey = apiKey))
            .retrieve()
            .bodyToMono(ApiKeyVerifyResponse::class.java)
            .timeout(Duration.ofMillis(securityProperties.verifyTimeoutMillis))
            .flatMap { response ->
                if (response.valid && !response.sourceId.isNullOrBlank()) {
                    Mono.just(ApiKeyPrincipal(sourceId = response.sourceId))
                } else {
                    Mono.empty()
                }
            }
            .onErrorResume { Mono.empty() }
    }

    private data class ApiKeyVerifyRequest(
        val apiKey: String,
    )

    private data class ApiKeyVerifyResponse(
        val valid: Boolean = false,
        val sourceId: String? = null,
    )

    private companion object {
        private const val INTERNAL_API_KEY_HEADER: String = "x-internal-api-key"
    }
}
