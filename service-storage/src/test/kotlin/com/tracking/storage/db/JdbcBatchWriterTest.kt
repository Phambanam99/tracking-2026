package com.tracking.storage.db

import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test

public class JdbcBatchWriterTest {
    @Test
    public fun `should instantiate jdbc batch writer skeleton`() {
        assertNotNull(JdbcBatchWriter())
    }
}
