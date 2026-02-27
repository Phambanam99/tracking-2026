package com.tracking.storage.worker

import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test

public class BatchPersistWorkerTest {
    @Test
    public fun `should instantiate batch persist worker skeleton`() {
        assertNotNull(BatchPersistWorker())
    }
}
