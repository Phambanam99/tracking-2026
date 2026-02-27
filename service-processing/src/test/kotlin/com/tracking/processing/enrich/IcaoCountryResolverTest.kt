package com.tracking.processing.enrich

import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import kotlin.test.Test

public class IcaoCountryResolverTest {
    @Test
    public fun `should resolve known icao range to country`() {
        val resolver = IcaoCountryResolver()

        val resolved = resolver.resolve("888001")

        resolved?.countryCode shouldBe "VN"
        resolved?.countryName shouldBe "Vietnam"
        resolved?.countryFlagUrl shouldBe "https://flagcdn.com/h80/vn.png"
    }

    @Test
    public fun `should return null for invalid icao`() {
        val resolver = IcaoCountryResolver()

        resolver.resolve("NOTHEX").shouldBeNull()
        resolver.imageUrlFor("NOTHEX").shouldBeNull()
    }

    @Test
    public fun `should build deterministic image url from template`() {
        val resolver = IcaoCountryResolver(imageUrlTemplate = "https://photos/{icao}.jpg")

        resolver.imageUrlFor("a0b1c2") shouldBe "https://photos/A0B1C2.jpg"
    }
}
