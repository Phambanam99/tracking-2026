package com.tracking.processing.enrich

public class IcaoCountryResolver(
    private val imageUrlTemplate: String = DEFAULT_IMAGE_URL_TEMPLATE,
) {
    public fun resolve(icao: String): IcaoCountryInfo? {
        val normalized = normalizeHex(icao) ?: return null
        val hex = normalized.toIntOrNull(radix = HEX_RADIX) ?: return null

        val country =
            COUNTRY_RANGES.firstOrNull { range ->
                hex in range.startHex..range.endHex
            } ?: return null

        return IcaoCountryInfo(
            countryCode = country.countryCode,
            countryName = country.countryName,
            countryFlagUrl = buildFlagUrl(country.countryCode),
        )
    }

    public fun imageUrlFor(icao: String): String? {
        val normalized = normalizeHex(icao) ?: return null
        return imageUrlTemplate.replace(ICAO_TEMPLATE_KEY, normalized)
    }

    private fun normalizeHex(icao: String): String? {
        val normalized = icao.trim().uppercase()
        if (normalized.length != ICAO_HEX_LENGTH) {
            return null
        }
        if (!normalized.all { it.isDigit() || it in 'A'..'F' }) {
            return null
        }
        return normalized
    }

    private fun buildFlagUrl(countryCode: String): String {
        return "$FLAG_CDN_BASE_URL/${countryCode.lowercase()}.png"
    }

    private data class CountryRange(
        val startHex: Int,
        val endHex: Int,
        val countryCode: String,
        val countryName: String,
    )

    private companion object {
        private const val HEX_RADIX: Int = 16
        private const val ICAO_HEX_LENGTH: Int = 6
        private const val ICAO_TEMPLATE_KEY: String = "{icao}"
        private const val FLAG_CDN_BASE_URL: String = "https://flagcdn.com/h80"
        private const val DEFAULT_IMAGE_URL_TEMPLATE: String = "https://images.planespotters.net/{icao}.jpg"

        private val COUNTRY_RANGES: List<CountryRange> =
            listOf(
                CountryRange(0xA00000, 0xAFFFFF, countryCode = "US", countryName = "United States"),
                CountryRange(0x888000, 0x88FFFF, countryCode = "VN", countryName = "Vietnam"),
                CountryRange(0x400000, 0x43FFFF, countryCode = "GB", countryName = "United Kingdom"),
                CountryRange(0x380000, 0x3BFFFF, countryCode = "FR", countryName = "France"),
            )
    }
}

public data class IcaoCountryInfo(
    val countryCode: String,
    val countryName: String,
    val countryFlagUrl: String,
)
