package com.tracking.processing.enrich

/**
 * Derives aircraft registration from its 24-bit ICAO hex address using
 * reverse-engineered allocation algorithms.
 *
 * Covers: US (N-numbers), Japan (JA), South Korea (HL), Russia (RA-),
 * Cuba (CU-T), and stride-encoded registrations for France, Germany,
 * Belgium, Denmark, Finland, Greece, Portugal, Romania, Turkey, Jordan,
 * Pakistan, Singapore, Syria, Canada, and Argentina.
 *
 * Ported from [tar1090/html/registrations.js](https://github.com/wiedehopf/tar1090).
 */
public class IcaoRegistrationResolver {

    /**
     * Resolves the registration string from [icaoHex], or `null` if the hex
     * address does not map to a known algorithmic registration scheme.
     */
    public fun resolve(icaoHex: String): String? {
        val hex = icaoHex.trim().toIntOrNull(16) ?: return null
        return nReg(hex)
            ?: jaReg(hex)
            ?: hlReg(hex)
            ?: numericReg(hex)
            ?: strideReg(hex)
    }

    // -------------------------------------------------------------------------
    // US N-numbers (0xA00001 – 0xADF7C7, 915399 addresses)
    // -------------------------------------------------------------------------

    private fun nLetters(rem: Int): String {
        if (rem == 0) return ""
        val r = rem - 1
        return LIMITED[r / 25].toString() + nLetter(r % 25)
    }

    private fun nLetter(rem: Int): String {
        if (rem == 0) return ""
        return LIMITED[rem - 1].toString()
    }

    private fun nReg(hex: Int): String? {
        var offset = hex - 0xA00001
        if (offset < 0 || offset >= 915399) return null

        val d1 = offset / 101711 + 1
        var reg = "N$d1"
        offset %= 101711
        if (offset <= 600) return reg + nLetters(offset)

        offset -= 601
        val d2 = offset / 10111
        reg += d2
        offset %= 10111
        if (offset <= 600) return reg + nLetters(offset)

        offset -= 601
        val d3 = offset / 951
        reg += d3
        offset %= 951
        if (offset <= 600) return reg + nLetters(offset)

        offset -= 601
        val d4 = offset / 35
        reg += d4
        offset %= 35
        if (offset <= 24) return reg + nLetter(offset)

        return reg + (offset - 25)
    }

    // -------------------------------------------------------------------------
    // Japan JA (0x840000 – 0x87FFFF)
    // -------------------------------------------------------------------------

    private fun jaReg(hex: Int): String? {
        var offset = hex - 0x840000
        if (offset < 0 || offset >= 229840) return null

        var reg = "JA"
        val d1 = offset / 22984
        if (d1 < 0 || d1 > 9) return null
        reg += d1
        offset %= 22984

        val d2 = offset / 916
        if (d2 < 0 || d2 > 9) return null
        reg += d2
        offset %= 916

        if (offset < 340) {
            val d3 = offset / 34
            reg += d3
            offset %= 34
            return if (offset < 10) reg + offset else reg + LIMITED[offset - 10]
        }
        offset -= 340
        val l3 = offset / 24
        return reg + LIMITED[l3] + LIMITED[offset % 24]
    }

    // -------------------------------------------------------------------------
    // South Korea HL
    // -------------------------------------------------------------------------

    private fun hlReg(hex: Int): String? {
        if (hex in 0x71BA00..0x71BF99) return "HL" + (hex - 0x71BA00 + 0x7200).toString(16)
        if (hex in 0x71C000..0x71C099) return "HL" + (hex - 0x71C000 + 0x8000).toString(16)
        if (hex in 0x71C200..0x71C299) return "HL" + (hex - 0x71C200 + 0x8200).toString(16)
        return null
    }

    // -------------------------------------------------------------------------
    // Numeric registrations (Russia RA-, Cuba CU-T)
    // -------------------------------------------------------------------------

    private fun numericReg(hex: Int): String? {
        for (m in NUMERIC_MAPPINGS) {
            if (hex < m.hexStart || hex > m.hexEnd) continue
            val n = (hex - m.hexStart + m.first).toString()
            return m.template.substring(0, m.template.length - n.length) + n
        }
        return null
    }

    // -------------------------------------------------------------------------
    // Stride-encoded registrations (France, Germany, Belgium, …)
    // -------------------------------------------------------------------------

    private fun strideReg(hex: Int): String? {
        for (m in STRIDE_MAPPINGS) {
            if (hex < m.hexStart || hex > m.hexEnd) continue
            val offset = hex - m.hexStart + m.offset
            val i1 = offset / m.s1
            val i2 = (offset % m.s1) / m.s2
            val i3 = (offset % m.s1) % m.s2
            val alpha = m.alphabet
            if (i1 !in alpha.indices || i2 !in alpha.indices || i3 !in alpha.indices) continue
            return m.prefix + alpha[i1] + alpha[i2] + alpha[i3]
        }
        return null
    }

    // -------------------------------------------------------------------------
    // Data classes
    // -------------------------------------------------------------------------

    private data class StrideMapping(
        val hexStart: Int,
        val s1: Int,
        val s2: Int,
        val prefix: String,
        val alphabet: String = FULL,
        /** Optional: suffix representing the first valid registration (shifts offset). */
        val first: String? = null,
        /** Optional: suffix representing the last valid registration (defines hexEnd). */
        val last: String? = null,
    ) {
        val offset: Int =
            if (first != null) {
                alphabet.indexOf(first[0]) * s1 +
                    alphabet.indexOf(first[1]) * s2 +
                    alphabet.indexOf(first[2])
            } else {
                0
            }

        val hexEnd: Int =
            if (last != null) {
                val c1 = alphabet.indexOf(last[0])
                val c2 = alphabet.indexOf(last[1])
                val c3 = alphabet.indexOf(last[2])
                hexStart - offset + c1 * s1 + c2 * s2 + c3
            } else {
                val n = alphabet.length
                hexStart - offset + (n - 1) * s1 + (n - 1) * s2 + (n - 1)
            }
    }

    private data class NumericMapping(
        val hexStart: Int,
        val first: Int,
        val count: Int,
        val template: String,
    ) {
        val hexEnd: Int = hexStart + count - 1
    }

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    private companion object {
        private const val FULL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        private const val LIMITED = "ABCDEFGHJKLMNPQRSTUVWXYZ" // no I, O

        private val NUMERIC_MAPPINGS =
            listOf(
                NumericMapping(hexStart = 0x140000, first = 0, count = 100000, template = "RA-00000"),
                NumericMapping(hexStart = 0x0B03E8, first = 1000, count = 1000, template = "CU-T0000"),
            )

        // Sourced from tar1090/html/registrations.js stride_mappings.
        private val STRIDE_MAPPINGS =
            listOf(
                // France
                StrideMapping(0x380000, s1 = 1024, s2 = 32, prefix = "F-B"),
                StrideMapping(0x388000, s1 = 1024, s2 = 32, prefix = "F-I"),
                StrideMapping(0x390000, s1 = 1024, s2 = 32, prefix = "F-G"),
                StrideMapping(0x398000, s1 = 1024, s2 = 32, prefix = "F-H"),
                StrideMapping(0x3A0000, s1 = 1024, s2 = 32, prefix = "F-O"),
                // Germany (D-A and D-B have two segments each: sparse then dense)
                StrideMapping(0x3C4421, s1 = 1024, s2 = 32, prefix = "D-A", first = "AAA", last = "OZZ"),
                StrideMapping(0x3C0001, s1 = 26 * 26, s2 = 26, prefix = "D-A", first = "PAA", last = "ZZZ"),
                StrideMapping(0x3C8421, s1 = 1024, s2 = 32, prefix = "D-B", first = "AAA", last = "OZZ"),
                StrideMapping(0x3C2001, s1 = 26 * 26, s2 = 26, prefix = "D-B", first = "PAA", last = "ZZZ"),
                StrideMapping(0x3CC000, s1 = 26 * 26, s2 = 26, prefix = "D-C"),
                StrideMapping(0x3D04A8, s1 = 26 * 26, s2 = 26, prefix = "D-E"),
                StrideMapping(0x3D4950, s1 = 26 * 26, s2 = 26, prefix = "D-F"),
                StrideMapping(0x3D8DF8, s1 = 26 * 26, s2 = 26, prefix = "D-G"),
                StrideMapping(0x3DD2A0, s1 = 26 * 26, s2 = 26, prefix = "D-H"),
                StrideMapping(0x3E1748, s1 = 26 * 26, s2 = 26, prefix = "D-I"),
                // Belgium
                StrideMapping(0x448421, s1 = 1024, s2 = 32, prefix = "OO-"),
                // Denmark
                StrideMapping(0x458421, s1 = 1024, s2 = 32, prefix = "OY-"),
                // Finland
                StrideMapping(0x460000, s1 = 26 * 26, s2 = 26, prefix = "OH-"),
                // Greece
                StrideMapping(0x468421, s1 = 1024, s2 = 32, prefix = "SX-"),
                // Portugal
                StrideMapping(0x490421, s1 = 1024, s2 = 32, prefix = "CS-"),
                // Romania
                StrideMapping(0x4A0421, s1 = 1024, s2 = 32, prefix = "YR-"),
                // Turkey
                StrideMapping(0x4B8421, s1 = 1024, s2 = 32, prefix = "TC-"),
                // Jordan
                StrideMapping(0x740421, s1 = 1024, s2 = 32, prefix = "JY-"),
                // Pakistan
                StrideMapping(0x760421, s1 = 1024, s2 = 32, prefix = "AP-"),
                // Singapore
                StrideMapping(0x768421, s1 = 1024, s2 = 32, prefix = "9V-"),
                // Syria
                StrideMapping(0x778421, s1 = 1024, s2 = 32, prefix = "YK-"),
                // Canada
                StrideMapping(0xC00001, s1 = 26 * 26, s2 = 26, prefix = "C-F"),
                StrideMapping(0xC044A9, s1 = 26 * 26, s2 = 26, prefix = "C-G"),
                // Argentina
                StrideMapping(0xE01041, s1 = 4096, s2 = 64, prefix = "LV-"),
            )
    }
}
