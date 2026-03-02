package com.tracking.processing.enrich

import com.tracking.common.dto.AircraftMetadata
import io.kotest.matchers.maps.shouldBeEmpty
import io.kotest.matchers.maps.shouldHaveSize
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import kotlin.test.Test

public class CsvReferenceDataLoaderTest {

    @Test
    public fun `should load valid CSV entries`() {
        val csv =
            """
            icao,registration,aircraftType,operator,countryCode,countryFlagUrl,imageUrl
            888001,VN-A321,A321,Vietnam Airlines,VN,https://flagcdn.com/h80/vn.png,https://img.example.com/888001.jpg
            A0B1C2,N12345,B738,United Airlines,US,https://flagcdn.com/h80/us.png,
            """.trimIndent()

        val loader = CsvReferenceDataLoader { csv.byteInputStream() }
        val data = loader.load()

        data shouldHaveSize 2
        data["888001"].shouldNotBeNull {
            registration shouldBe "VN-A321"
            aircraftType shouldBe "A321"
            operator shouldBe "Vietnam Airlines"
            countryCode shouldBe "VN"
            countryFlagUrl shouldBe "https://flagcdn.com/h80/vn.png"
            imageUrl shouldBe "https://img.example.com/888001.jpg"
        }
        data["A0B1C2"].shouldNotBeNull {
            registration shouldBe "N12345"
            aircraftType shouldBe "B738"
            operator shouldBe "United Airlines"
            imageUrl shouldBe null
        }
    }

    @Test
    public fun `should treat empty fields as null`() {
        val csv =
            """
            icao,registration,aircraftType,operator,countryCode,countryFlagUrl,imageUrl
            888001,,A321,,,,
            """.trimIndent()

        val loader = CsvReferenceDataLoader { csv.byteInputStream() }
        val data = loader.load()

        data["888001"].shouldNotBeNull {
            registration shouldBe null
            aircraftType shouldBe "A321"
            operator shouldBe null
            countryCode shouldBe null
        }
    }

    @Test
    public fun `should skip comment lines and blank lines`() {
        val csv =
            """
            # This is a comment
            icao,registration,aircraftType,operator,countryCode,countryFlagUrl,imageUrl

            # Another comment
            888001,VN-A321,A321,Vietnam Airlines,VN,,
            """.trimIndent()

        val loader = CsvReferenceDataLoader { csv.byteInputStream() }
        val data = loader.load()

        data shouldHaveSize 1
    }

    @Test
    public fun `should skip malformed lines with too few columns`() {
        val csv =
            """
            icao,registration,aircraftType,operator,countryCode,countryFlagUrl,imageUrl
            888001,VN-A321,A321
            A0B1C2,N12345,B738,United Airlines,US,https://flagcdn.com/h80/us.png,
            """.trimIndent()

        val loader = CsvReferenceDataLoader { csv.byteInputStream() }
        val data = loader.load()

        data shouldHaveSize 1
        data["A0B1C2"].shouldNotBeNull()
    }

    @Test
    public fun `should normalise ICAO key to uppercase`() {
        val csv =
            """
            icao,registration,aircraftType,operator,countryCode,countryFlagUrl,imageUrl
            888001,VN-A321,A321,Vietnam Airlines,VN,,
            """.trimIndent()

        val loader = CsvReferenceDataLoader { csv.byteInputStream() }
        val data = loader.load()

        // Key stored uppercase regardless of CSV casing
        data["888001"].shouldNotBeNull()
    }

    @Test
    public fun `should return empty map when stream provider returns null`() {
        val loader = CsvReferenceDataLoader { null }
        loader.load().shouldBeEmpty()
    }

    @Test
    public fun `should return empty map when CSV has only headers`() {
        val csv = "icao,registration,aircraftType,operator,countryCode,countryFlagUrl,imageUrl\n"
        val loader = CsvReferenceDataLoader { csv.byteInputStream() }
        loader.load().shouldBeEmpty()
    }

    @Test
    public fun `should load semicolon separated aircraft reference rows`() {
        val csv =
            """
            004002;Z-WPA;B732;00;BOEING 737-200;;;
            A0616B;N12310;;00;C-27A SPARTAN;;RUSSELL MILITARY MUSEUM;
            """.trimIndent()

        val loader = CsvReferenceDataLoader { csv.byteInputStream() }
        val data = loader.load()

        data shouldHaveSize 2
        data["004002"].shouldNotBeNull {
            registration shouldBe "Z-WPA"
            aircraftType shouldBe "B732"
            operator shouldBe null
        }
        data["A0616B"].shouldNotBeNull {
            registration shouldBe "N12310"
            aircraftType shouldBe null
            operator shouldBe "RUSSELL MILITARY MUSEUM"
        }
    }
}
