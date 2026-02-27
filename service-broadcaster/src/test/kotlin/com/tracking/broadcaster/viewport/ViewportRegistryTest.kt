package com.tracking.broadcaster.viewport

import com.tracking.common.dto.BoundingBox
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import kotlin.concurrent.thread
import kotlin.test.Test

public class ViewportRegistryTest {
    @Test
    public fun `should register unregister and query sessions by coordinate`() {
        val registry = ViewportRegistry()
        registry.register("session-1", "alice", BoundingBox(22.0, 20.0, 106.0, 105.0))
        registry.register("session-2", "bob", BoundingBox(40.0, 30.0, 120.0, 110.0))

        val matching = registry.sessionsContaining(21.0, 105.5)

        matching.map { it.sessionId } shouldContain "session-1"
        matching.map { it.sessionId }.contains("session-2").shouldBeFalse()
        registry.unregister("session-1").shouldBeTrue()
        registry.isRegistered("session-1").shouldBeFalse()
    }

    @Test
    public fun `should support concurrent register operations`() {
        val registry = ViewportRegistry()
        val viewport = BoundingBox(22.0, 20.0, 106.0, 105.0)
        val workers = (1..8).map { workerIndex ->
            thread(start = true) {
                repeat(100) { item ->
                    registry.register("session-$workerIndex-$item", "user-$workerIndex", viewport)
                }
            }
        }

        workers.forEach(Thread::join)

        registry.activeSessions() shouldBe 800
        registry.sessionsContaining(21.0, 105.5) shouldHaveSize 800
    }
}
