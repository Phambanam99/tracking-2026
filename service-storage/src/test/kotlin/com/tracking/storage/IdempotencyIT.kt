package com.tracking.storage

import com.tracking.storage.retry.StorageRetryPolicy
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

public class IdempotencyIT {
    @Test
    public fun `should cap retry delay to max value`() {
        val policy = StorageRetryPolicy(baseDelayMillis = 100, maxDelayMillis = 500)

        assertEquals(500, policy.nextDelayMillis(10))
    }
}
