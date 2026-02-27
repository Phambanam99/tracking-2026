package com.tracking.broadcaster.security

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "tracking.broadcaster.security")
public class BroadcasterSecurityProperties {
    public var failClosed: Boolean = true
    public var jwtIssuer: String = "tracking-auth"
    public var jwksUri: String = "http://service-auth:8081/api/v1/auth/.well-known/jwks.json"
    public var jwksRefreshIntervalMillis: Long = 300000
    public var jwksConnectTimeoutMillis: Long = 300
    public var jwksReadTimeoutMillis: Long = 1000
    public var accessTokenTtlSeconds: Long = 900
    public var revocationUserTtlSeconds: Long = 900
}
