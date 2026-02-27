package com.tracking.broadcaster.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "tracking.broadcaster")
public class BroadcasterProperties {
    public var ws: WebSocketProperties = WebSocketProperties()
    public var consumer: ConsumerProperties = ConsumerProperties()
    public var cleanup: CleanupProperties = CleanupProperties()

    public class WebSocketProperties {
        public var allowedOriginPatterns: List<String> = listOf("*")
        public var maxViewportUpdatesPerMinute: Int = 10
    }

    public class ConsumerProperties {
        public var groupId: String = "service-broadcaster-v1"
        public var autoOffsetReset: String = "latest"
        public var maxPollRecords: Int = 500
        public var retry: RetryProperties = RetryProperties()
    }

    public class RetryProperties {
        public var backoffMillis: Long = 1000
        public var maxAttempts: Long = 3
    }

    public class CleanupProperties {
        public var intervalMillis: Long = 30000
        public var staleTimeoutMillis: Long = 300000
    }
}
