package com.tracking.auth.internal

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
public class InternalApiKeyAuthenticationFilter(
    private val internalRequestSecurity: InternalRequestSecurity,
) : OncePerRequestFilter() {
    override fun shouldNotFilter(request: HttpServletRequest): Boolean {
        return !request.requestURI.startsWith(INTERNAL_PATH_PREFIX)
    }

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val providedApiKey = request.getHeader(INTERNAL_API_KEY_HEADER)
        if (!internalRequestSecurity.isValidInternalApiKey(providedApiKey)) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid internal api key")
            return
        }

        if (SecurityContextHolder.getContext().authentication == null) {
            val authentication = UsernamePasswordAuthenticationToken(
                INTERNAL_PRINCIPAL,
                null,
                listOf(SimpleGrantedAuthority(ROLE_INTERNAL)),
            )
            SecurityContextHolder.getContext().authentication = authentication
        }

        filterChain.doFilter(request, response)
    }

    private companion object {
        private const val INTERNAL_PATH_PREFIX: String = "/internal/"
        private const val INTERNAL_API_KEY_HEADER: String = "x-internal-api-key"
        private const val INTERNAL_PRINCIPAL: String = "internal-service"
        private const val ROLE_INTERNAL: String = "ROLE_INTERNAL"
    }
}
