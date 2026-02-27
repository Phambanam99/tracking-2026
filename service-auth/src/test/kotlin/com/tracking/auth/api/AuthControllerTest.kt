package com.tracking.auth.api

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.auth.internal.InternalApiKeyAuthenticationFilter
import com.tracking.auth.security.JwtAuthenticationFilter
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.verify
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@WebMvcTest(controllers = [AuthController::class])
@AutoConfigureMockMvc(addFilters = false)
public class AuthControllerTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var objectMapper: ObjectMapper

    @MockBean
    private lateinit var authService: AuthService

    @MockBean
    private lateinit var jwtAuthenticationFilter: JwtAuthenticationFilter

    @MockBean
    private lateinit var internalApiKeyAuthenticationFilter: InternalApiKeyAuthenticationFilter

    @Test
    public fun `should register and return tokens`() {
        val request = RegisterRequest(
            username = "alice",
            email = "alice@example.com",
            password = "StrongPass123!",
        )

        given(authService.register(request)).willReturn(
            AuthTokensResponse(
                accessToken = "access-001",
                refreshToken = "refresh-001",
            ),
        )

        mockMvc.perform(
            post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.accessToken").value("access-001"))
            .andExpect(jsonPath("$.refreshToken").value("refresh-001"))
    }

    @Test
    public fun `should reject invalid register request`() {
        val invalidPayload =
            """
            {
              "username": "",
              "email": "invalid",
              "password": ""
            }
            """.trimIndent()

        mockMvc.perform(
            post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalidPayload),
        )
            .andExpect(status().isBadRequest)
    }

    @Test
    public fun `should login and return tokens`() {
        val request = LoginRequest(
            username = "alice",
            password = "StrongPass123!",
        )

        given(authService.login(request)).willReturn(
            AuthTokensResponse(
                accessToken = "access-login",
                refreshToken = "refresh-login",
            ),
        )

        mockMvc.perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.accessToken").value("access-login"))
            .andExpect(jsonPath("$.refreshToken").value("refresh-login"))
    }

    @Test
    public fun `should refresh token pair`() {
        val request = RefreshTokenRequest(refreshToken = "refresh-old")

        given(authService.refresh(request)).willReturn(
            AuthTokensResponse(
                accessToken = "access-refresh",
                refreshToken = "refresh-next",
            ),
        )

        mockMvc.perform(
            post("/api/v1/auth/refresh-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.accessToken").value("access-refresh"))
            .andExpect(jsonPath("$.refreshToken").value("refresh-next"))
    }

    @Test
    public fun `should logout successfully`() {
        val request = LogoutRequest(refreshToken = "refresh-old")

        mockMvc.perform(
            post("/api/v1/auth/logout")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)),
        )
            .andExpect(status().isOk)

        verify(authService).logout(request)
    }
}
