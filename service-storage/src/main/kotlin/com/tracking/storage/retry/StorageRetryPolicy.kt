package com.tracking.storage.retry

public class StorageRetryPolicy(
    private val baseDelayMillis: Long = 100L,
    private val maxDelayMillis: Long = 3_000L,
) {
    public fun nextDelayMillis(attempt: Int): Long {
        val normalizedAttempt = attempt.coerceAtLeast(1)
        val delay = baseDelayMillis * (1L shl (normalizedAttempt - 1))
        return delay.coerceAtMost(maxDelayMillis)
    }
}
