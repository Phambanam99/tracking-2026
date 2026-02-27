package com.tracking.gateway.filter

public class ApiKeyFilter {
    public fun extractApiKey(headerValue: String?): String? {
        val normalized = headerValue?.trim().orEmpty()
        return normalized.takeIf { it.isNotEmpty() }
    }
}
