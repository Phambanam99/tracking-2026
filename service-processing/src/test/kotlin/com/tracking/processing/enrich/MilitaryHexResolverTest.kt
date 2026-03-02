package com.tracking.processing.enrich

import io.kotest.matchers.shouldBe
import io.kotest.matchers.ints.shouldBeGreaterThan
import kotlin.test.Test

public class MilitaryHexResolverTest {
    @Test
    public fun `should identify known military hex from bundled database`() {
        val resolver = MilitaryHexResolver()

        resolver.loadedCount shouldBeGreaterThan 20_000
        resolver.isMilitary("ae292b") shouldBe true
    }

    @Test
    public fun `should return false for unknown hex`() {
        val resolver = MilitaryHexResolver(setOf("ae292b"))

        resolver.isMilitary("abcdef") shouldBe false
    }
}
