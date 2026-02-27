package com.tracking.auth.config

import com.tracking.auth.internal.InternalApiKeyAuthenticationFilter
import com.tracking.auth.security.JwtAuthenticationFilter
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.HttpStatusEntryPoint
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter

@Configuration
@EnableWebSecurity
public class SecurityConfig(
    private val internalApiKeyAuthenticationFilter: InternalApiKeyAuthenticationFilter,
    private val jwtAuthenticationFilter: JwtAuthenticationFilter,
) {
    private val publicPaths: Set<String> = setOf(
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh-token",
        "/api/v1/auth/.well-known/jwks.json",
        "/actuator/health",
    )

    @Bean
    public fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .csrf { csrf -> csrf.disable() }
            .sessionManagement { sessions -> sessions.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests { auth ->
                auth
                    .requestMatchers("/internal/**").hasRole("INTERNAL")
                    .requestMatchers("/api/v1/auth/api-keys/**").hasRole("ADMIN")
                    .requestMatchers(*publicPaths.toTypedArray()).permitAll()
                    .anyRequest().authenticated()
            }
            .exceptionHandling { handling ->
                handling.authenticationEntryPoint(HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
            }
            .addFilterBefore(internalApiKeyAuthenticationFilter, UsernamePasswordAuthenticationFilter::class.java)
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter::class.java)

        return http.build()
    }

    @Bean
    public fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    public fun isPublicPath(path: String): Boolean {
        return publicPaths.any { publicPath -> path == publicPath || path.startsWith("$publicPath/") }
    }
}
