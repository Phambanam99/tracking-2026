package com.tracking.auth.watchlist

import com.tracking.auth.config.SecurityConfig
import com.tracking.auth.internal.InternalRequestSecurity
import com.tracking.auth.security.JwtService
import com.tracking.auth.security.UserPrincipal
import java.time.Instant
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.BDDMockito.willDoNothing
import org.mockito.Mockito.verify
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@WebMvcTest(controllers = [WatchlistController::class])
@AutoConfigureMockMvc
@Import(SecurityConfig::class)
public class WatchlistControllerTest {

    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockBean
    private lateinit var watchlistService: WatchlistService

    @MockBean
    private lateinit var jwtService: JwtService

    @MockBean
    private lateinit var internalRequestSecurity: InternalRequestSecurity

    private val alice = UserPrincipal(id = 1L, username = "alice", roles = setOf("ROLE_USER"))
    private val aliceAuth = UsernamePasswordAuthenticationToken.authenticated(
        alice,
        null,
        listOf(SimpleGrantedAuthority("ROLE_USER")),
    )

    // -----------------------------------------------------------------------
    // GET /api/v1/watchlist
    // -----------------------------------------------------------------------

    @Test
    public fun `should return 401 when unauthenticated`() {
        mockMvc.perform(get("/api/v1/watchlist"))
            .andExpect(status().isUnauthorized)
    }

    @Test
    public fun `should list groups for authenticated user`() {
        given(watchlistService.getGroupsByUser(1L)).willReturn(
            listOf(
                WatchlistGroupDto(
                    id = 10L,
                    name = "My Planes",
                    color = "#3b82f6",
                    entryCount = 2,
                    createdAt = Instant.now().toString(),
                    updatedAt = Instant.now().toString(),
                ),
            ),
        )

        mockMvc.perform(get("/api/v1/watchlist").with(authentication(aliceAuth)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].name").value("My Planes"))
            .andExpect(jsonPath("$[0].entryCount").value(2))
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/watchlist
    // -----------------------------------------------------------------------

    @Test
    public fun `should create group and return 201`() {
        val created = WatchlistGroupDto(
            id = 11L,
            name = "New Group",
            color = "#ef4444",
            entryCount = 0,
            createdAt = Instant.now().toString(),
            updatedAt = Instant.now().toString(),
        )
        given(watchlistService.createGroup(1L, CreateGroupRequest(name = "New Group", color = "#ef4444")))
            .willReturn(created)

        mockMvc.perform(
            post("/api/v1/watchlist")
                .with(authentication(aliceAuth))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"name":"New Group","color":"#ef4444"}"""),
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.id").value(11))
            .andExpect(jsonPath("$.name").value("New Group"))
    }

    @Test
    public fun `should return 400 when group name is blank`() {
        mockMvc.perform(
            post("/api/v1/watchlist")
                .with(authentication(aliceAuth))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"name":""}"""),
        )
            .andExpect(status().isBadRequest)
    }

    // -----------------------------------------------------------------------
    // DELETE /api/v1/watchlist/{groupId}
    // -----------------------------------------------------------------------

    @Test
    public fun `should delete group and return 204`() {
        willDoNothing().given(watchlistService).deleteGroup(1L, 10L)

        mockMvc.perform(delete("/api/v1/watchlist/10").with(authentication(aliceAuth)))
            .andExpect(status().isNoContent)

        verify(watchlistService).deleteGroup(1L, 10L)
    }

    @Test
    public fun `should return 404 when deleting non-existent group`() {
        given(watchlistService.deleteGroup(1L, 999L))
            .willThrow(WatchlistNotFoundException("Group 999 not found"))

        mockMvc.perform(delete("/api/v1/watchlist/999").with(authentication(aliceAuth)))
            .andExpect(status().isNotFound)
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/watchlist/{groupId}/aircraft
    // -----------------------------------------------------------------------

    @Test
    public fun `should add aircraft to group and return 201`() {
        val entry = WatchlistEntryDto(
            id = 1L,
            groupId = 10L,
            icao = "ABC123",
            note = null,
            addedAt = Instant.now().toString(),
        )
        given(watchlistService.addAircraft(1L, 10L, AddAircraftRequest(icao = "abc123")))
            .willReturn(entry)

        mockMvc.perform(
            post("/api/v1/watchlist/10/aircraft")
                .with(authentication(aliceAuth))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"icao":"abc123"}"""),
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.icao").value("ABC123"))
    }

    @Test
    public fun `should return 400 when icao format is invalid`() {
        mockMvc.perform(
            post("/api/v1/watchlist/10/aircraft")
                .with(authentication(aliceAuth))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"icao":"INVALID!"}"""),
        )
            .andExpect(status().isBadRequest)
    }
}
