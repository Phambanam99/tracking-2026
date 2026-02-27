package com.tracking.gateway.security

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.gateway.config.GatewayResilienceProperties
import java.math.BigInteger
import java.security.KeyPairGenerator
import java.security.interfaces.RSAPublicKey
import java.util.ArrayDeque
import java.util.Base64
import java.util.concurrent.atomic.AtomicInteger
import java.util.function.Function
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.cloud.client.circuitbreaker.ReactiveCircuitBreaker
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.reactive.function.client.ClientResponse
import org.springframework.web.reactive.function.client.ExchangeFunction
import org.springframework.web.reactive.function.client.WebClient
import reactor.core.publisher.Flux
import reactor.core.publisher.Mono

public class JwksCacheServiceTest {
    @Test
    public fun `should cache jwks key after first fetch`() {
        val callCount = AtomicInteger(0)
        val keyPair = generateKeyPair()
        val kid = "kid-1"
        val jwks = jwksJson(kid, keyPair)
        val exchangeFunction = ExchangeFunction {
            callCount.incrementAndGet()
            Mono.just(successResponse(jwks))
        }
        val service = buildService(exchangeFunction)

        val resolvedFirst = service.resolveKey(kid).block()
        val resolvedSecond = service.resolveKey(kid).block()

        assertNotNull(resolvedFirst)
        assertNotNull(resolvedSecond)
        assertTrue(service.isKidCached(kid))
        assertEquals(1, callCount.get())
    }

    @Test
    public fun `should refresh jwks when kid is missing in cache`() {
        val firstKid = "kid-old"
        val secondKid = "kid-new"
        val firstJwks = jwksJson(firstKid, generateKeyPair())
        val secondJwks = jwksJson(secondKid, generateKeyPair())

        val responses = ArrayDeque<Mono<ClientResponse>>().apply {
            add(Mono.just(successResponse(firstJwks)))
            add(Mono.just(successResponse(secondJwks)))
        }
        val callCount = AtomicInteger(0)
        val exchangeFunction = ExchangeFunction {
            callCount.incrementAndGet()
            responses.removeFirst()
        }
        val service = buildService(exchangeFunction)

        val oldKey = service.resolveKey(firstKid).block()
        val newKey = service.resolveKey(secondKid).block()

        assertNotNull(oldKey)
        assertNotNull(newKey)
        assertEquals(2, callCount.get())
    }

    @Test
    public fun `should fail closed when missing kid and refresh fails`() {
        val firstKid = "kid-old"
        val initialJwks = jwksJson(firstKid, generateKeyPair())
        val responses = ArrayDeque<Mono<ClientResponse>>().apply {
            add(Mono.just(successResponse(initialJwks)))
            add(Mono.error(RuntimeException("network down")))
        }
        val exchangeFunction = ExchangeFunction { responses.removeFirst() }
        val service = buildService(exchangeFunction)

        val oldKey = service.resolveKey(firstKid).block()
        assertNotNull(oldKey)

        val error = runCatching {
            service.resolveKey("kid-missing").block()
        }.exceptionOrNull()

        assertNotNull(error)
    }

    private fun buildService(exchangeFunction: ExchangeFunction): JwksCacheService {
        return JwksCacheService(
            authWebClient = WebClient.builder().exchangeFunction(exchangeFunction).build(),
            circuitBreaker = PassthroughCircuitBreaker(),
            objectMapper = ObjectMapper(),
            securityProperties = GatewaySecurityProperties(),
            resilienceProperties = GatewayResilienceProperties(),
        )
    }

    private fun successResponse(body: String): ClientResponse {
        return ClientResponse.create(HttpStatus.OK)
            .header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
            .body(body)
            .build()
    }

    private fun generateKeyPair(): RSAPublicKey {
        val generator = KeyPairGenerator.getInstance("RSA")
        generator.initialize(2048)
        return generator.generateKeyPair().public as RSAPublicKey
    }

    private fun jwksJson(kid: String, publicKey: RSAPublicKey): String {
        val n = toBase64Url(publicKey.modulus)
        val e = toBase64Url(publicKey.publicExponent)
        return """{"keys":[{"kty":"RSA","kid":"$kid","n":"$n","e":"$e"}]}"""
    }

    private fun toBase64Url(value: BigInteger): String {
        val bytes = value.toByteArray().dropWhile { it == 0.toByte() }.toByteArray()
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    private class PassthroughCircuitBreaker : ReactiveCircuitBreaker {
        override fun <T : Any?> run(toRun: Mono<T>): Mono<T> = toRun

        override fun <T : Any?> run(
            toRun: Mono<T>,
            fallback: Function<Throwable, Mono<T>>,
        ): Mono<T> {
            return toRun.onErrorResume { error -> fallback.apply(error) }
        }

        override fun <T : Any?> run(
            toRun: Flux<T>,
            fallback: Function<Throwable, Flux<T>>,
        ): Flux<T> {
            return toRun.onErrorResume { error -> fallback.apply(error) }
        }
    }
}
