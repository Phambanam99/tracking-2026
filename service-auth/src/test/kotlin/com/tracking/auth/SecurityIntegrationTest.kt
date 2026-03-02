package com.tracking.auth

import com.tracking.auth.api.JwksController
import com.tracking.auth.config.SecurityConfig
import com.tracking.auth.internal.InternalApiKeyAuthenticationFilter
import com.tracking.auth.internal.InternalRequestSecurity
import com.tracking.auth.security.EncryptionService
import com.tracking.auth.security.JwksKeyProvider
import com.tracking.auth.security.JwtAuthenticationFilter
import com.tracking.auth.security.JwtService
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@WebMvcTest(controllers = [JwksController::class, SecurityProbeController::class])
@Import(SecurityConfig::class, SecurityTestBeans::class)
public class SecurityIntegrationTest {
    @Autowired
    private lateinit var securityConfig: SecurityConfig

    @Autowired
    private lateinit var jwtService: JwtService

    @Autowired
    private lateinit var mockMvc: MockMvc

    @Test
    public fun `should mark public auth endpoints correctly`() {
        assertTrue(securityConfig.isPublicPath("/api/v1/auth/login"))
        assertTrue(securityConfig.isPublicPath("/api/v1/auth/register"))
        assertTrue(securityConfig.isPublicPath("/api/v1/auth/.well-known/jwks.json"))
        assertTrue(securityConfig.isPublicPath("/actuator/prometheus"))
    }

    @Test
    public fun `should reject non public endpoints in matcher`() {
        assertFalse(securityConfig.isPublicPath("/api/v1/private/profile"))
    }

    @Test
    public fun `should allow access to public jwks endpoint without token`() {
        mockMvc.perform(get("/api/v1/auth/.well-known/jwks.json"))
            .andExpect(status().isOk)
    }

    @Test
    public fun `should allow access to prometheus actuator without token`() {
        mockMvc.perform(get("/actuator/prometheus"))
            .andExpect(status().isOk)
            .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_PLAIN))
            .andExpect(content().string("# metrics"))
    }

    @Test
    public fun `should block protected endpoint without token`() {
        mockMvc.perform(get("/api/v1/private/ping"))
            .andExpect(status().isUnauthorized)
    }

    @Test
    public fun `should allow protected endpoint with valid jwt`() {
        val accessToken = jwtService.generateAccessToken(1L, "alice", setOf("ROLE_USER"))

        mockMvc.perform(
            get("/api/v1/private/ping")
                .header(HttpHeaders.AUTHORIZATION, "Bearer $accessToken"),
        )
            .andExpect(status().isOk)
            .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_PLAIN))
            .andExpect(content().string("pong"))
    }

    @Test
    public fun `should reject internal endpoint without internal api key`() {
        mockMvc.perform(post("/internal/v1/probe"))
            .andExpect(status().isUnauthorized)
    }

    @Test
    public fun `should allow internal endpoint with valid internal api key`() {
        mockMvc.perform(
            post("/internal/v1/probe")
                .header("x-internal-api-key", "test-internal-key"),
        )
            .andExpect(status().isOk)
            .andExpect(content().string("internal-ok"))
    }
}

@TestConfiguration
internal class SecurityTestBeans {
    @Bean
    fun encryptionService(): EncryptionService = EncryptionService(TEST_MASTER_KEY)

    @Bean
    fun jwksKeyProvider(encryptionService: EncryptionService): JwksKeyProvider = JwksKeyProvider(
        encryptionService = encryptionService,
    )

    @Bean
    fun jwtService(jwksKeyProvider: JwksKeyProvider): JwtService = JwtService(jwksKeyProvider)

    @Bean
    fun jwtAuthenticationFilter(jwtService: JwtService): JwtAuthenticationFilter = JwtAuthenticationFilter(jwtService)

    @Bean
    fun internalRequestSecurity(): InternalRequestSecurity = InternalRequestSecurity("test-internal-key")

    @Bean
    fun internalApiKeyAuthenticationFilter(
        internalRequestSecurity: InternalRequestSecurity,
    ): InternalApiKeyAuthenticationFilter = InternalApiKeyAuthenticationFilter(internalRequestSecurity)

    private companion object {
        private const val TEST_MASTER_KEY: String = "abcdefghijklmnopqrstuvwxyz123456"
    }
}

@RestController
internal class SecurityProbeController {
    @GetMapping("/actuator/prometheus")
    public fun prometheus(): String = "# metrics"

    @GetMapping("/api/v1/private/ping")
    public fun ping(): String = "pong"

    @PostMapping("/internal/v1/probe")
    public fun internalProbe(): String = "internal-ok"
}
