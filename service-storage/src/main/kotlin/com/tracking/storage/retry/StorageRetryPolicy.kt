package com.tracking.storage.retry

public class StorageRetryPolicy(
    private val retryDelaysMillis: List<Long> = listOf(0L, 1_000L, 3_000L),
    private val sleeper: (Long) -> Unit = { delay -> Thread.sleep(delay) },
) {
    public fun nextDelayMillis(attempt: Int): Long {
        val normalizedAttempt = attempt.coerceAtLeast(1)
        val index = (normalizedAttempt - 1).coerceAtMost(retryDelaysMillis.lastIndex)
        return retryDelaysMillis[index].coerceAtLeast(0L)
    }

    public fun <T> execute(operation: (attempt: Int) -> T): T {
        var lastError: Throwable? = null
        for (attempt in 1..retryDelaysMillis.size.coerceAtLeast(1)) {
            val delayMillis = nextDelayMillis(attempt)
            if (delayMillis > 0) {
                sleeper(delayMillis)
            }

            try {
                return operation(attempt)
            } catch (error: Throwable) {
                lastError = error
            }
        }

        throw IllegalStateException("Retry attempts exhausted.", lastError)
    }
}
