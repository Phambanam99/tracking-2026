package com.tracking.auth.apikey

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.auth.internal.InternalApiKeyAuthenticationFilter
import com.tracking.auth.security.JwtAuthenticationFilter
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.doNothing
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@WebMvcTest(controllers = [ApiKeyController::class])
@AutoConfigureMockMvc(addFilters = false)
public class ApiKeyControllerTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var objectMapper: ObjectMapper

    @MockBean
    private lateinit var apiKeyService: ApiKeyService

    @MockBean
    private lateinit var jwtAuthenticationFilter: JwtAuthenticationFilter

    @MockBean
    private lateinit var internalApiKeyAuthenticationFilter: InternalApiKeyAuthenticationFilter

    @Test
    public fun `should create api key and return plaintext once`() {
        given(apiKeyService.createApiKey("crawler-a")).willReturn(
            IssuedApiKey(
                id = 10L,
                sourceId = "crawler-a",
                plaintextApiKey = "trk_live_abc123",
                active = true,
            ),
        )

        val request = CreateApiKeyRequest(sourceId = "crawler-a")

        mockMvc.perform(
            post("/api/v1/auth/api-keys")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(10))
            .andExpect(jsonPath("$.sourceId").value("crawler-a"))
            .andExpect(jsonPath("$.apiKey").value("trk_live_abc123"))
            .andExpect(jsonPath("$.active").value(true))
    }

    @Test
    public fun `should revoke api key`() {
        doNothing().`when`(apiKeyService).revokeApiKey(55L)

        mockMvc.perform(
            post("/api/v1/auth/api-keys/55/revoke"),
        )
            .andExpect(status().isNoContent)
    }
}
