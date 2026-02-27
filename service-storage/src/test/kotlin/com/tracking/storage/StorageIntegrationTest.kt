package com.tracking.storage

import com.tracking.storage.retry.StorageRetryPolicy
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

public class StorageIntegrationTest {
    @Test
    public fun `should increase retry delay exponentially`() {
        val policy = StorageRetryPolicy(baseDelayMillis = 100, maxDelayMillis = 3_000)

        assertEquals(100, policy.nextDelayMillis(1))
        assertEquals(200, policy.nextDelayMillis(2))
        assertEquals(400, policy.nextDelayMillis(3))
    }
}
