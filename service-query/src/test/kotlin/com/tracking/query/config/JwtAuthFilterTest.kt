package com.tracking.query.config

import java.nio.charset.StandardCharsets
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

    private fun jwtWithKid(kid: String): String {
        val encoder = Base64.getUrlEncoder().withoutPadding()
        val header = encoder.encodeToString("""{"alg":"RS256","kid":"$kid"}""".toByteArray(StandardCharsets.UTF_8))
        val payload = encoder.encodeToString("""{"sub":"pilot"}""".toByteArray(StandardCharsets.UTF_8))
        val signature = encoder.encodeToString("signature".toByteArray(StandardCharsets.UTF_8))
        return "$header.$payload.$signature"
    }
}
