package com.tracking.auth.security

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpHeaders
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
public class JwtAuthenticationFilter(
    private val jwtService: JwtService,
) : OncePerRequestFilter() {
    private val publicPaths: Set<String> = setOf(
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh-token",
        "/api/v1/auth/.well-known/jwks.json",
        "/actuator/health",
    )

    override fun shouldNotFilter(request: HttpServletRequest): Boolean {
        val path = request.requestURI
        if (path.startsWith("/internal/")) {
            return true
        }

        return publicPaths.any { publicPath -> path == publicPath || path.startsWith("$publicPath/") }
    }

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val authHeader = request.getHeader(HttpHeaders.AUTHORIZATION)
        val token = jwtService.extractBearerToken(authHeader)

        if (token != null && SecurityContextHolder.getContext().authentication == null) {
            val username = jwtService.extractUsername(token)
            val userId = jwtService.extractUserId(token)

            if (username != null && userId != null
                && jwtService.isTokenValid(token, username)
                && !jwtService.isRefreshToken(token)
            ) {
                val roles = jwtService.extractRoles(token)
                val authorities = roles.map { role -> SimpleGrantedAuthority(role) }
                val principal = UserPrincipal(id = userId, username = username, roles = roles)
                val authentication = UsernamePasswordAuthenticationToken(principal, null, authorities)
                authentication.details = WebAuthenticationDetailsSource().buildDetails(request)
                SecurityContextHolder.getContext().authentication = authentication
            }
        }

        filterChain.doFilter(request, response)
    }
}
