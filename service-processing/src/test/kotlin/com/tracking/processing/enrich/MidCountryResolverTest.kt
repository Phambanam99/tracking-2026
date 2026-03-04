package com.tracking.processing.enrich

import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import kotlin.test.Test

public class MidCountryResolverTest {

    private val resolver = MidCountryResolver()

    @Test
    public fun `should resolve Viet Nam from MMSI starting with 574`() {
        val result = resolver.resolve("574123456")

        result?.countryCode shouldBe "VN"
        result?.countryName shouldBe "Viet Nam"
        result?.flagUrl shouldBe "https://flagcdn.com/h80/vn.png"
    }

    @Test
    public fun `should resolve Panama from MMSI starting with 351`() {
        val result = resolver.resolve("351000001")

        result?.countryCode shouldBe "PA"
        result?.countryName shouldBe "Panama"
        result?.flagUrl shouldBe "https://flagcdn.com/h80/pa.png"
    }

    @Test
    public fun `should resolve Germany from MMSI starting with 211`() {
        val result = resolver.resolve("211345678")

        result?.countryCode shouldBe "DE"
        result?.countryName shouldBe "Germany"
        result?.flagUrl shouldBe "https://flagcdn.com/h80/de.png"
    }

    @Test
    public fun `should return null for empty MMSI`() {
        resolver.resolve("").shouldBeNull()
    }

    @Test
    public fun `should return null for MMSI too short`() {
        resolver.resolve("12345").shouldBeNull()
    }

    @Test
    public fun `should return null for MMSI too long`() {
        resolver.resolve("1234567890").shouldBeNull()
    }

    @Test
    public fun `should return null for non-numeric MMSI`() {
        resolver.resolve("abc123456").shouldBeNull()
    }

    @Test
    public fun `should return null for unknown MID`() {
        // MID 999 is not a valid ITU-assigned MID
        resolver.resolve("999000000").shouldBeNull()
    }

    @Test
    public fun `should build correct flag URL with lowercase country code`() {
        val result = resolver.resolve("574000001")
        result?.flagUrl shouldBe "https://flagcdn.com/h80/vn.png"
    }
}
