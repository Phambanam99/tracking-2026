package com.tracking.storage

import com.tracking.storage.retry.StorageRetryPolicy
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.util.concurrent.atomic.AtomicInteger

public class StorageIntegrationTest {
    @Test
    public fun `should execute operation successfully after retries`() {
        val slept: MutableList<Long> = mutableListOf()
        val policy = StorageRetryPolicy(retryDelaysMillis = listOf(0L, 100L, 300L)) { delay -> slept.add(delay) }
        val attempts = AtomicInteger(0)

        val result = policy.execute {
            if (attempts.incrementAndGet() < 3) {
                throw IllegalStateException("temporary error")
            }
            "ok"
        }

        assertEquals("ok", result)
        assertEquals(3, attempts.get())
        assertEquals(listOf(100L, 300L), slept)
    }
}
