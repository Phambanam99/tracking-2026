package com.tracking.processing.enrich

import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import kotlin.test.Test

public class IcaoRegistrationResolverTest {
    private val resolver = IcaoRegistrationResolver()

    // ── US N-numbers ─────────────────────────────────────────────────────────

    @Test
    public fun `should resolve first US N-number`() {
        // A00001 → offset=0 → N1 (digit1=1, offset=0 ≤600 → nLetters(0)="")
        resolver.resolve("A00001") shouldBe "N1"
    }

    @Test
    public fun `should resolve US N-number with two-letter suffix`() {
        // A00002 → offset=1 → digit1=1, offset%101711=1 ≤600 → nLetters(1)="A"
        resolver.resolve("A00002") shouldBe "N1A"
    }

    @Test
    public fun `should resolve US N-number N5-prefix`() {
        // A00001 + 4*101711 = A7A5BD → N5
        val hexId = (0xA00001 + 4 * 101711).toString(16).uppercase()
        resolver.resolve(hexId) shouldBe "N5"
    }

    @Test
    public fun `should return null for address outside US range`() {
        resolver.resolve("900000").shouldBeNull()
    }

    @Test
    public fun `should return null for address just below US range`() {
        resolver.resolve("9FFFFF").shouldBeNull()
    }

    // ── Japan JA ─────────────────────────────────────────────────────────────

    @Test
    public fun `should resolve Japan JA registration`() {
        // 0x840000 → offset=0, d1=0, d2=0, d3=0, 4th digit=0 → "JA0000"
        resolver.resolve("840000") shouldBe "JA0000"
    }

    @Test
    public fun `should return null for address just outside Japan range`() {
        resolver.resolve("880000").shouldBeNull() // Thailand range, not JA
    }

    // ── South Korea HL ───────────────────────────────────────────────────────

    @Test
    public fun `should resolve Korea HL registration`() {
        // 0x71BA00 → "HL7200"
        resolver.resolve("71BA00") shouldBe "HL7200"
    }

    @Test
    public fun `should resolve Korea HL second sub-range`() {
        // 0x71C000 → "HL8000"
        resolver.resolve("71C000") shouldBe "HL8000"
    }

    // ── Numeric: Russia RA- ──────────────────────────────────────────────────

    @Test
    public fun `should resolve Russia RA-00000`() {
        // start=0x140000, first=0, template="RA-00000" → RA-00000
        resolver.resolve("140000") shouldBe "RA-00000"
    }

    @Test
    public fun `should resolve Russia RA-00001`() {
        resolver.resolve("140001") shouldBe "RA-00001"
    }

    @Test
    public fun `should resolve Russia RA-99999`() {
        // start + 99999 = 0x140000 + 0x1869F = 0x15869F
        val hexId = (0x140000 + 99999).toString(16).uppercase()
        resolver.resolve(hexId) shouldBe "RA-99999"
    }

    // ── Numeric: Cuba CU-T ───────────────────────────────────────────────────

    @Test
    public fun `should resolve Cuba CU-T1000`() {
        // start=0x0B03E8, first=1000 → 0x0B03E8 + 0 → "CU-T1000"
        resolver.resolve("0B03E8") shouldBe "CU-T1000"
    }

    // ── Stride: France ───────────────────────────────────────────────────────

    @Test
    public fun `should resolve France F-B registration`() {
        // 0x380000 → offset=0 → i1=0,i2=0,i3=0 → "F-BAAA"
        resolver.resolve("380000") shouldBe "F-BAAA"
    }

    // ── Stride: Germany ──────────────────────────────────────────────────────

    @Test
    public fun `should resolve Germany D-C registration`() {
        // 0x3CC000 → offset=0 → i1=0,i2=0,i3=0 → "D-CAAA"
        resolver.resolve("3CC000") shouldBe "D-CAAA"
    }

    // ── Stride: Canada ───────────────────────────────────────────────────────

    @Test
    public fun `should resolve Canada C-F registration`() {
        // 0xC00001 → offset=0 → i1=0,i2=0,i3=0 → "C-FAAA"
        resolver.resolve("C00001") shouldBe "C-FAAA"
    }

    // ── Edge cases ───────────────────────────────────────────────────────────

    @Test
    public fun `should return null for invalid hex string`() {
        resolver.resolve("ZZZZZZ").shouldBeNull()
    }

    @Test
    public fun `should return null for ICAO with no known scheme`() {
        // 0x000001 – Africa range, no algorithmic registration
        resolver.resolve("000001").shouldBeNull()
    }

    @Test
    public fun `should handle lowercase input`() {
        resolver.resolve("a00001") shouldBe "N1"
    }
}
