package com.tracking.auth.admin

import com.tracking.auth.config.SecurityConfig
import com.tracking.auth.internal.InternalRequestSecurity
import com.tracking.auth.security.JwtService
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.context.annotation.Import
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@WebMvcTest(controllers = [UserAdminController::class])
@AutoConfigureMockMvc
@Import(SecurityConfig::class)
public class UserAdminControllerTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockBean
    private lateinit var userAdminService: UserAdminService

    @MockBean
    private lateinit var jwtService: JwtService

    @MockBean
    private lateinit var internalRequestSecurity: InternalRequestSecurity

    @Test
    public fun `should allow admin to list users`() {
        given(userAdminService.listUsers(page = 0, size = 20))
            .willReturn(
                UserAdminListResponse(
                    content = listOf(
                        UserAdminView(
                            id = 1L,
                            username = "alice",
                            email = "alice@example.com",
                            enabled = true,
                            roles = listOf("ROLE_USER"),
                            createdAt = "2026-01-01T00:00:00Z",
                        ),
                    ),
                    page = 0,
                    size = 20,
                    totalElements = 1,
                    totalPages = 1,
                ),
            )

        mockMvc.perform(get("/api/v1/auth/users").with(user("admin").roles("ADMIN")))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.content[0].username").value("alice"))
            .andExpect(jsonPath("$.content[0].enabled").value(true))
            .andExpect(jsonPath("$.totalElements").value(1))
    }

    @Test
    public fun `should reject non admin user listing`() {
        mockMvc.perform(get("/api/v1/auth/users").with(user("pilot").roles("USER")))
            .andExpect(status().isForbidden)

        verifyNoInteractions(userAdminService)
    }

    @Test
    public fun `should allow admin to disable user`() {
        mockMvc.perform(put("/api/v1/auth/users/10/disable").with(user("admin").roles("ADMIN")))
            .andExpect(status().isNoContent)

        verify(userAdminService).disableUser(10L, "admin")
    }

    @Test
    public fun `should allow admin to enable user`() {
        mockMvc.perform(put("/api/v1/auth/users/10/enable").with(user("admin").roles("ADMIN")))
            .andExpect(status().isNoContent)

        verify(userAdminService).enableUser(10L, "admin")
    }
}
