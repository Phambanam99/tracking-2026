package com.tracking.ingestion.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "tracking.ingestion")
public class IngestionProperties(
    public var ingestPath: String = "/api/v1/ingest/**",
    public var batch: BatchProperties = BatchProperties(),
    public var admission: AdmissionProperties = AdmissionProperties(),
    public var security: SecurityProperties = SecurityProperties(),
)

public class BatchProperties(
    public var maxRecords: Int = 1000,
)

public class AdmissionProperties(
    public var maxInFlight: Int = 1024,
)

public class SecurityProperties(
    public var enforceApiKey: Boolean = true,
    public var apiKeyHeader: String = "x-api-key",
    public var sourceIdHeader: String = "X-Source-Id",
    public var authVerifyUri: String = "http://service-auth:8081/internal/v1/api-keys/verify",
    public var internalApiKey: String = "",
    public var verifyTimeoutMillis: Long = 300,
    public var cacheTtlSeconds: Long = 60,
    public var revocationSourceTtlSeconds: Long = 900,
)
