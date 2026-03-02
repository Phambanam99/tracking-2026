package com.tracking.query.config

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.nio.charset.StandardCharsets
import java.security.KeyPairGenerator
import java.security.interfaces.RSAPublicKey
import java.util.Base64
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockFilterChain
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.security.core.context.SecurityContextHolder

class JwtAuthFilterTest {

    @AfterEach
    fun tearDown() {
        SecurityContextHolder.clearContext()
    }

    @Test
    fun `should ignore bearer token when jwks key cannot be resolved`() {
        val filter = JwtAuthFilter(
            jwksUri = "http://127.0.0.1:9/unavailable",
            jwksCacheTtlSeconds = 300,
        )
        val request = MockHttpServletRequest("GET", "/api/v1/aircraft/ABC123/photo/local")
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()
        request.addHeader("Authorization", "Bearer ${jwtWithKid("missing-kid")}")

        assertDoesNotThrow {
            filter.doFilter(request, response, chain)
        }

        assertNull(SecurityContextHolder.getContext().authentication)
    }

    @Test
    fun `should not fail with runtime exception when jwks endpoint returns a valid key`() {
        val keyPair = KeyPairGenerator.getInstance("RSA").apply { initialize(1024) }.generateKeyPair()
        val publicKey = keyPair.public as RSAPublicKey
        val jwksJson =
            """
            {
              "keys": [
                {
                  "kty": "RSA",
                  "kid": "test-kid",
                  "alg": "RS256",
                  "use": "sig",
                  "n": "${base64Url(publicKey.modulus.toByteArray())}",
                  "e": "${base64Url(publicKey.publicExponent.toByteArray())}"
                }
              ]
            }
            """.trimIndent()
        val server =
            HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
                createContext("/jwks") { exchange ->
                    val payload = jwksJson.toByteArray(StandardCharsets.UTF_8)
                    exchange.sendResponseHeaders(200, payload.size.toLong())
                    exchange.responseBody.use { it.write(payload) }
                }
                start()
            }

        try {
            val filter = JwtAuthFilter(
                jwksUri = "http://127.0.0.1:${server.address.port}/jwks",
                jwksCacheTtlSeconds = 300,
            )
            val request = MockHttpServletRequest("GET", "/api/v1/aircraft/live")
            val response = MockHttpServletResponse()
            val chain = MockFilterChain()
            request.addHeader("Authorization", "Bearer ${jwtWithKid("test-kid")}")

            assertDoesNotThrow {
                filter.doFilter(request, response, chain)
            }

            assertNull(SecurityContextHolder.getContext().authentication)
        } finally {
            server.stop(0)
        }
    }

    private fun jwtWithKid(kid: String): String {
        val encoder = Base64.getUrlEncoder().withoutPadding()
        val header = encoder.encodeToString("""{"alg":"RS256","kid":"$kid"}""".toByteArray(StandardCharsets.UTF_8))
        val payload = encoder.encodeToString("""{"sub":"pilot"}""".toByteArray(StandardCharsets.UTF_8))
        val signature = encoder.encodeToString("signature".toByteArray(StandardCharsets.UTF_8))
        return "$header.$payload.$signature"
    }

    private fun base64Url(bytes: ByteArray): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString(bytes.dropWhile { it == 0.toByte() }.toByteArray())
}
