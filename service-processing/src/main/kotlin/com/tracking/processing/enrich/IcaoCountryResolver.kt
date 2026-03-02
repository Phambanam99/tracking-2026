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
            countryCode = country.countryCode.uppercase(),
            countryName = country.countryName,
            countryFlagUrl = buildFlagUrl(country.countryCode),
        )
    }

    public fun imageUrlFor(icao: String): String? {
        if (imageUrlTemplate.isBlank()) {
            return null
        }
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

        // Sourced from tar1090/html/flags.js (wiedehopf/tar1090).
        // Order matters: more-specific sub-ranges (e.g. UK territories) must
        // appear BEFORE the catch-all range that contains them.
        private val COUNTRY_RANGES: List<CountryRange> =
            listOf(
                // Africa
                CountryRange(0x004000, 0x0047FF, "zw", "Zimbabwe"),
                CountryRange(0x006000, 0x006FFF, "mz", "Mozambique"),
                CountryRange(0x008000, 0x00FFFF, "za", "South Africa"),
                CountryRange(0x010000, 0x017FFF, "eg", "Egypt"),
                CountryRange(0x018000, 0x01FFFF, "ly", "Libya"),
                CountryRange(0x020000, 0x027FFF, "ma", "Morocco"),
                CountryRange(0x028000, 0x02FFFF, "tn", "Tunisia"),
                CountryRange(0x030000, 0x0307FF, "bw", "Botswana"),
                CountryRange(0x032000, 0x032FFF, "bi", "Burundi"),
                CountryRange(0x034000, 0x034FFF, "cm", "Cameroon"),
                CountryRange(0x035000, 0x0357FF, "km", "Comoros"),
                CountryRange(0x036000, 0x036FFF, "cg", "Republic of the Congo"),
                CountryRange(0x038000, 0x038FFF, "ci", "Côte d'Ivoire"),
                CountryRange(0x03E000, 0x03EFFF, "ga", "Gabon"),
                CountryRange(0x040000, 0x040FFF, "et", "Ethiopia"),
                CountryRange(0x042000, 0x042FFF, "gq", "Equatorial Guinea"),
                CountryRange(0x044000, 0x044FFF, "gh", "Ghana"),
                CountryRange(0x046000, 0x046FFF, "gn", "Guinea"),
                CountryRange(0x048000, 0x0487FF, "gw", "Guinea-Bissau"),
                CountryRange(0x04A000, 0x04A7FF, "ls", "Lesotho"),
                CountryRange(0x04C000, 0x04CFFF, "ke", "Kenya"),
                CountryRange(0x050000, 0x050FFF, "lr", "Liberia"),
                CountryRange(0x054000, 0x054FFF, "mg", "Madagascar"),
                CountryRange(0x058000, 0x058FFF, "mw", "Malawi"),
                CountryRange(0x05A000, 0x05A7FF, "mv", "Maldives"),
                CountryRange(0x05C000, 0x05CFFF, "ml", "Mali"),
                CountryRange(0x05E000, 0x05E7FF, "mr", "Mauritania"),
                CountryRange(0x060000, 0x0607FF, "mu", "Mauritius"),
                CountryRange(0x062000, 0x062FFF, "ne", "Niger"),
                CountryRange(0x064000, 0x064FFF, "ng", "Nigeria"),
                CountryRange(0x068000, 0x068FFF, "ug", "Uganda"),
                CountryRange(0x06A000, 0x06AFFF, "qa", "Qatar"),
                CountryRange(0x06C000, 0x06CFFF, "cf", "Central African Republic"),
                CountryRange(0x06E000, 0x06EFFF, "rw", "Rwanda"),
                CountryRange(0x070000, 0x070FFF, "sn", "Senegal"),
                CountryRange(0x074000, 0x0747FF, "sc", "Seychelles"),
                CountryRange(0x076000, 0x0767FF, "sl", "Sierra Leone"),
                CountryRange(0x078000, 0x078FFF, "so", "Somalia"),
                CountryRange(0x07A000, 0x07A7FF, "sz", "Eswatini"),
                CountryRange(0x07C000, 0x07CFFF, "sd", "Sudan"),
                CountryRange(0x080000, 0x080FFF, "tz", "Tanzania"),
                CountryRange(0x084000, 0x084FFF, "td", "Chad"),
                CountryRange(0x088000, 0x088FFF, "tg", "Togo"),
                CountryRange(0x08A000, 0x08AFFF, "zm", "Zambia"),
                CountryRange(0x08C000, 0x08CFFF, "cd", "DR Congo"),
                CountryRange(0x090000, 0x090FFF, "ao", "Angola"),
                CountryRange(0x094000, 0x0947FF, "bj", "Benin"),
                CountryRange(0x096000, 0x0967FF, "cv", "Cabo Verde"),
                CountryRange(0x098000, 0x0987FF, "dj", "Djibouti"),
                CountryRange(0x09A000, 0x09AFFF, "gm", "Gambia"),
                CountryRange(0x09C000, 0x09CFFF, "bf", "Burkina Faso"),
                CountryRange(0x09E000, 0x09E7FF, "st", "São Tomé and Príncipe"),
                CountryRange(0x0A0000, 0x0A7FFF, "dz", "Algeria"),
                // Americas (Caribbean / Central)
                CountryRange(0x0A8000, 0x0A8FFF, "bs", "Bahamas"),
                CountryRange(0x0AA000, 0x0AA7FF, "bb", "Barbados"),
                CountryRange(0x0AB000, 0x0AB7FF, "bz", "Belize"),
                CountryRange(0x0AC000, 0x0ADFFF, "co", "Colombia"),
                CountryRange(0x0AE000, 0x0AEFFF, "cr", "Costa Rica"),
                CountryRange(0x0B0000, 0x0B0FFF, "cu", "Cuba"),
                CountryRange(0x0B2000, 0x0B2FFF, "sv", "El Salvador"),
                CountryRange(0x0B4000, 0x0B4FFF, "gt", "Guatemala"),
                CountryRange(0x0B6000, 0x0B6FFF, "gy", "Guyana"),
                CountryRange(0x0B8000, 0x0B8FFF, "ht", "Haiti"),
                CountryRange(0x0BA000, 0x0BAFFF, "hn", "Honduras"),
                CountryRange(0x0BC000, 0x0BC7FF, "vc", "Saint Vincent and the Grenadines"),
                CountryRange(0x0BE000, 0x0BEFFF, "jm", "Jamaica"),
                CountryRange(0x0C0000, 0x0C0FFF, "ni", "Nicaragua"),
                CountryRange(0x0C2000, 0x0C2FFF, "pa", "Panama"),
                CountryRange(0x0C4000, 0x0C4FFF, "do", "Dominican Republic"),
                CountryRange(0x0C6000, 0x0C6FFF, "tt", "Trinidad and Tobago"),
                CountryRange(0x0C8000, 0x0C8FFF, "sr", "Suriname"),
                CountryRange(0x0CA000, 0x0CA7FF, "ag", "Antigua and Barbuda"),
                CountryRange(0x0CC000, 0x0CC7FF, "gd", "Grenada"),
                CountryRange(0x0D0000, 0x0D7FFF, "mx", "Mexico"),
                CountryRange(0x0D8000, 0x0DFFFF, "ve", "Venezuela"),
                // Russia
                CountryRange(0x100000, 0x1FFFFF, "ru", "Russia"),
                // Africa (cont.)
                CountryRange(0x201000, 0x2017FF, "na", "Namibia"),
                CountryRange(0x202000, 0x2027FF, "er", "Eritrea"),
                // Europe (W)
                CountryRange(0x300000, 0x33FFFF, "it", "Italy"),
                CountryRange(0x340000, 0x37FFFF, "es", "Spain"),
                CountryRange(0x380000, 0x3BFFFF, "fr", "France"),
                CountryRange(0x3C0000, 0x3FFFFF, "de", "Germany"),
                // UK territories listed BEFORE catch-all UK range
                CountryRange(0x400000, 0x4001BF, "bm", "Bermuda"),
                CountryRange(0x4001C0, 0x4001FF, "ky", "Cayman Islands"),
                CountryRange(0x400300, 0x4003FF, "tc", "Turks and Caicos Islands"),
                CountryRange(0x424135, 0x4241F2, "ky", "Cayman Islands"),
                CountryRange(0x424200, 0x4246FF, "bm", "Bermuda"),
                CountryRange(0x424700, 0x424899, "ky", "Cayman Islands"),
                CountryRange(0x424B00, 0x424BFF, "im", "Isle of Man"),
                CountryRange(0x43BE00, 0x43BEFF, "bm", "Bermuda"),
                CountryRange(0x43E700, 0x43EAFD, "im", "Isle of Man"),
                CountryRange(0x43EAFE, 0x43EEFF, "gg", "Guernsey"),
                // Catch-all UK
                CountryRange(0x400000, 0x43FFFF, "gb", "United Kingdom"),
                // Europe (cont.)
                CountryRange(0x440000, 0x447FFF, "at", "Austria"),
                CountryRange(0x448000, 0x44FFFF, "be", "Belgium"),
                CountryRange(0x450000, 0x457FFF, "bg", "Bulgaria"),
                CountryRange(0x458000, 0x45FFFF, "dk", "Denmark"),
                CountryRange(0x460000, 0x467FFF, "fi", "Finland"),
                CountryRange(0x468000, 0x46FFFF, "gr", "Greece"),
                CountryRange(0x470000, 0x477FFF, "hu", "Hungary"),
                CountryRange(0x478000, 0x47FFFF, "no", "Norway"),
                CountryRange(0x480000, 0x487FFF, "nl", "Netherlands"),
                CountryRange(0x488000, 0x48FFFF, "pl", "Poland"),
                CountryRange(0x490000, 0x497FFF, "pt", "Portugal"),
                CountryRange(0x498000, 0x49FFFF, "cz", "Czechia"),
                CountryRange(0x4A0000, 0x4A7FFF, "ro", "Romania"),
                CountryRange(0x4A8000, 0x4AFFFF, "se", "Sweden"),
                CountryRange(0x4B0000, 0x4B7FFF, "ch", "Switzerland"),
                CountryRange(0x4B8000, 0x4BFFFF, "tr", "Turkey"),
                CountryRange(0x4C0000, 0x4C7FFF, "rs", "Serbia"),
                CountryRange(0x4C8000, 0x4C87FF, "cy", "Cyprus"),
                CountryRange(0x4CA000, 0x4CAFFF, "ie", "Ireland"),
                CountryRange(0x4CC000, 0x4CCFFF, "is", "Iceland"),
                CountryRange(0x4D0000, 0x4D07FF, "lu", "Luxembourg"),
                CountryRange(0x4D2000, 0x4D27FF, "mt", "Malta"),
                CountryRange(0x4D4000, 0x4D47FF, "mc", "Monaco"),
                CountryRange(0x500000, 0x5007FF, "sm", "San Marino"),
                CountryRange(0x501000, 0x5017FF, "al", "Albania"),
                CountryRange(0x501800, 0x501FFF, "hr", "Croatia"),
                CountryRange(0x502800, 0x502FFF, "lv", "Latvia"),
                CountryRange(0x503800, 0x503FFF, "lt", "Lithuania"),
                CountryRange(0x504800, 0x504FFF, "md", "Moldova"),
                CountryRange(0x505800, 0x505FFF, "sk", "Slovakia"),
                CountryRange(0x506800, 0x506FFF, "si", "Slovenia"),
                CountryRange(0x507800, 0x507FFF, "uz", "Uzbekistan"),
                CountryRange(0x508000, 0x50FFFF, "ua", "Ukraine"),
                CountryRange(0x510000, 0x5107FF, "by", "Belarus"),
                CountryRange(0x511000, 0x5117FF, "ee", "Estonia"),
                CountryRange(0x512000, 0x5127FF, "mk", "North Macedonia"),
                CountryRange(0x513000, 0x5137FF, "ba", "Bosnia and Herzegovina"),
                CountryRange(0x514000, 0x5147FF, "ge", "Georgia"),
                CountryRange(0x515000, 0x5157FF, "tj", "Tajikistan"),
                CountryRange(0x516000, 0x5167FF, "me", "Montenegro"),
                // Caucasus / Central Asia
                CountryRange(0x600000, 0x6007FF, "am", "Armenia"),
                CountryRange(0x600800, 0x600FFF, "az", "Azerbaijan"),
                CountryRange(0x601000, 0x6017FF, "kg", "Kyrgyzstan"),
                CountryRange(0x601800, 0x601FFF, "tm", "Turkmenistan"),
                // Asia (Pacific / South)
                CountryRange(0x680000, 0x6807FF, "bt", "Bhutan"),
                CountryRange(0x681000, 0x6817FF, "fm", "Micronesia, Federated States of"),
                CountryRange(0x682000, 0x6827FF, "mn", "Mongolia"),
                CountryRange(0x683000, 0x6837FF, "kz", "Kazakhstan"),
                CountryRange(0x684000, 0x6847FF, "pw", "Palau"),
                // Asia (Middle East / South Asia)
                CountryRange(0x700000, 0x700FFF, "af", "Afghanistan"),
                CountryRange(0x702000, 0x702FFF, "bd", "Bangladesh"),
                CountryRange(0x704000, 0x704FFF, "mm", "Myanmar"),
                CountryRange(0x706000, 0x706FFF, "kw", "Kuwait"),
                CountryRange(0x708000, 0x708FFF, "la", "Laos"),
                CountryRange(0x70A000, 0x70AFFF, "np", "Nepal"),
                CountryRange(0x70C000, 0x70C7FF, "om", "Oman"),
                CountryRange(0x70E000, 0x70EFFF, "kh", "Cambodia"),
                CountryRange(0x710000, 0x717FFF, "sa", "Saudi Arabia"),
                CountryRange(0x718000, 0x71FFFF, "kr", "South Korea"),
                CountryRange(0x720000, 0x727FFF, "kp", "North Korea"),
                CountryRange(0x728000, 0x72FFFF, "iq", "Iraq"),
                CountryRange(0x730000, 0x737FFF, "ir", "Iran"),
                CountryRange(0x738000, 0x73FFFF, "il", "Israel"),
                CountryRange(0x740000, 0x747FFF, "jo", "Jordan"),
                CountryRange(0x748000, 0x74FFFF, "lb", "Lebanon"),
                CountryRange(0x750000, 0x757FFF, "my", "Malaysia"),
                CountryRange(0x758000, 0x75FFFF, "ph", "Philippines"),
                CountryRange(0x760000, 0x767FFF, "pk", "Pakistan"),
                CountryRange(0x768000, 0x76FFFF, "sg", "Singapore"),
                CountryRange(0x770000, 0x777FFF, "lk", "Sri Lanka"),
                CountryRange(0x778000, 0x77FFFF, "sy", "Syria"),
                // Hong Kong sub-range listed BEFORE China catch-all
                CountryRange(0x789000, 0x789FFF, "hk", "Hong Kong"),
                CountryRange(0x780000, 0x7BFFFF, "cn", "China"),
                // Asia (East / Oceania)
                CountryRange(0x7C0000, 0x7FFFFF, "au", "Australia"),
                CountryRange(0x800000, 0x83FFFF, "in", "India"),
                CountryRange(0x840000, 0x87FFFF, "jp", "Japan"),
                CountryRange(0x880000, 0x887FFF, "th", "Thailand"),
                CountryRange(0x888000, 0x88FFFF, "vn", "Vietnam"),
                CountryRange(0x890000, 0x890FFF, "ye", "Yemen"),
                CountryRange(0x894000, 0x894FFF, "bh", "Bahrain"),
                CountryRange(0x895000, 0x8957FF, "bn", "Brunei"),
                CountryRange(0x896000, 0x896FFF, "ae", "United Arab Emirates"),
                CountryRange(0x897000, 0x8977FF, "sb", "Solomon Islands"),
                CountryRange(0x898000, 0x898FFF, "pg", "Papua New Guinea"),
                CountryRange(0x899000, 0x8997FF, "tw", "Taiwan"),
                CountryRange(0x8A0000, 0x8A7FFF, "id", "Indonesia"),
                // Pacific
                CountryRange(0x900000, 0x9007FF, "mh", "Marshall Islands"),
                CountryRange(0x901000, 0x9017FF, "ck", "Cook Islands"),
                CountryRange(0x902000, 0x9027FF, "ws", "Samoa"),
                // Americas (North)
                CountryRange(0xA00000, 0xAFFFFF, "us", "United States"),
                CountryRange(0xC00000, 0xC3FFFF, "ca", "Canada"),
                // Americas (Pacific)
                CountryRange(0xC80000, 0xC87FFF, "nz", "New Zealand"),
                CountryRange(0xC88000, 0xC88FFF, "fj", "Fiji"),
                CountryRange(0xC8A000, 0xC8A7FF, "nr", "Nauru"),
                CountryRange(0xC8C000, 0xC8C7FF, "lc", "Saint Lucia"),
                CountryRange(0xC8D000, 0xC8D7FF, "to", "Tonga"),
                CountryRange(0xC8E000, 0xC8E7FF, "ki", "Kiribati"),
                CountryRange(0xC90000, 0xC907FF, "vu", "Vanuatu"),
                CountryRange(0xC91000, 0xC917FF, "ad", "Andorra"),
                CountryRange(0xC92000, 0xC927FF, "dm", "Dominica"),
                CountryRange(0xC93000, 0xC937FF, "kn", "Saint Kitts and Nevis"),
                CountryRange(0xC94000, 0xC947FF, "ss", "South Sudan"),
                CountryRange(0xC95000, 0xC957FF, "tl", "Timor-Leste"),
                CountryRange(0xC97000, 0xC977FF, "tv", "Tuvalu"),
                // Americas (South)
                CountryRange(0xE00000, 0xE3FFFF, "ar", "Argentina"),
                CountryRange(0xE40000, 0xE7FFFF, "br", "Brazil"),
                CountryRange(0xE80000, 0xE80FFF, "cl", "Chile"),
                CountryRange(0xE84000, 0xE84FFF, "ec", "Ecuador"),
                CountryRange(0xE88000, 0xE88FFF, "py", "Paraguay"),
                CountryRange(0xE8C000, 0xE8CFFF, "pe", "Peru"),
                CountryRange(0xE90000, 0xE90FFF, "uy", "Uruguay"),
                CountryRange(0xE94000, 0xE94FFF, "bo", "Bolivia"),
            )
    }
}

public data class IcaoCountryInfo(
    val countryCode: String,
    val countryName: String,
    val countryFlagUrl: String,
)
