package com.tracking.storage

import com.tracking.storage.retry.StorageRetryPolicy
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

public class IdempotencyIT {
    @Test
    public fun `should cap retry delay to final configured value`() {
        val policy = StorageRetryPolicy(retryDelaysMillis = listOf(0L, 200L, 500L))

        assertEquals(500, policy.nextDelayMillis(10))
    }
}
