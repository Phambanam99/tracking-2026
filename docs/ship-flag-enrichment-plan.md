# Plan: Enrich AIS Data with Country Flag from MMSI

## Tổng quan

Dữ liệu AIS trong hệ thống hiện tại có trường `mmsi` (Maritime Mobile Service Identity) nhưng **chưa resolve ra tên quốc gia và cờ quốc gia**. Trong khi đó:

- `ShipMetadata` DTO đã có sẵn các trường `flagCountry`, `flagUrl`, `isMilitary` — nhưng **chưa bao giờ được populate**.
- File `mids.json` (MID → country mapping) đã tồn tại ở root repo nhưng **chưa được sử dụng**.
- Frontend (`ShipDetailPanel`) đã sẵn sàng hiển thị `flagCountry` — nhưng luôn nhận `null`.
- Topic contract `live-ais` đã spec `flag_country` / `flag_url` trong metadata.

**Mục tiêu**: Xây dựng `MidCountryResolver` từ `mids.json`, tích hợp vào `ShipEnricher` để populate `flagCountry` + `flagUrl` cho mọi ship position.

---

## Phân tích hiện trạng

### Pipeline hiện tại

```
Connector → Ingestion → Kafka [raw-ais] → Processing (ShipEnricher) → Kafka [live-ais] → Storage / Broadcaster
```

### ShipEnricher hiện tại (`service-processing`)

```kotlin
// ShipEnricher.kt — chỉ title-case vesselType
fun enrich(ship: CanonicalShip, isHistorical: Boolean): EnrichedShip {
    // ...copy all fields...
    metadata = buildMetadata(ship)  // chỉ set shipTypeName
}

private fun buildMetadata(ship: CanonicalShip): ShipMetadata? {
    val vesselType = ship.vesselType ?: return null  // ⚠️ return null nếu vesselType == null
    return ShipMetadata(shipTypeName = vesselType.titlecase())
}
```

**Vấn đề**:
1. Nếu `vesselType == null` → `metadata = null` → mất cơ hội enrich flag.
2. `flagCountry`, `flagUrl`, `isMilitary` luôn là `null` / `false`.

### MID (Maritime Identification Digits)

3 chữ số đầu tiên của MMSI (9 chữ số) xác định quốc gia đăng ký tàu. Ví dụ:
- MMSI `574123456` → MID `574` → Vietnam 🇻🇳
- MMSI `211345678` → MID `211` → Germany 🇩🇪
- MMSI `366789012` → MID `366` → United States 🇺🇸

File `mids.json` chứa mapping: `"MID" → [iso2, iso3, subdivision, countryName]`

---

## Kế hoạch triển khai

### Task 1: Tạo `MidCountryResolver` (service-processing)

**File mới**: `service-processing/src/main/kotlin/com/tracking/processing/enrich/MidCountryResolver.kt`

Thiết kế tương tự `IcaoCountryResolver` (đã có cho aircraft):

```kotlin
package com.tracking.processing.enrich

/**
 * Resolves the flag country of a vessel from its MMSI using the
 * Maritime Identification Digits (first 3 digits).
 *
 * Data source: ITU MID table (mids.json).
 */
public class MidCountryResolver {

    public fun resolve(mmsi: String): MidCountryInfo? {
        val mid = extractMid(mmsi) ?: return null
        val entry = MID_TABLE[mid] ?: return null
        return MidCountryInfo(
            countryCode = entry.iso2,
            countryName = entry.countryName,
            flagUrl = buildFlagUrl(entry.iso2),
        )
    }

    private fun extractMid(mmsi: String): String? {
        val digits = mmsi.trim()
        if (digits.length != MMSI_LENGTH) return null
        if (!digits.all { it.isDigit() }) return null
        return digits.substring(0, MID_LENGTH)
    }

    private fun buildFlagUrl(countryCode: String): String =
        "$FLAG_CDN_BASE_URL/${countryCode.lowercase()}.png"

    private companion object {
        private const val MMSI_LENGTH = 9
        private const val MID_LENGTH = 3
        private const val FLAG_CDN_BASE_URL = "https://flagcdn.com/h80"
        // Load bảng MID tĩnh từ embedded data (xem Task 2)
        private val MID_TABLE: Map<String, MidEntry> = loadMidTable()
    }
}

public data class MidCountryInfo(
    val countryCode: String,   // ISO 3166-1 alpha-2 (e.g. "VN")
    val countryName: String,   // Full name (e.g. "Viet Nam")
    val flagUrl: String,       // CDN URL to flag image
)

internal data class MidEntry(
    val iso2: String,
    val iso3: String,
    val subdivision: String,
    val countryName: String,
)
```

### Task 2: Load dữ liệu MID

**Hai phương án**:

| Phương án | Mô tả | Ưu điểm | Nhược điểm |
|-----------|--------|----------|-------------|
| **A. Embedded Map** | Hardcode `MID_TABLE` trong companion object (giống `IcaoCountryResolver` với COUNTRY_RANGES) | Không cần I/O, nhanh, consistent | File lớn (~300 entries) |
| **B. Load từ classpath** | Copy `mids.json` vào `src/main/resources/` và parse bằng Jackson/kotlinx-serialization khi khởi tạo | Dễ update data | Cần dependency parse JSON |

**Đề xuất: Phương án A** (embedded map) — consistent với pattern `IcaoCountryResolver`, không thêm runtime dependencies, dữ liệu MID ổn định (ITU cập nhật rất hiếm).

Biến đổi `mids.json` thành Kotlin map literal:

```kotlin
private val MID_TABLE: Map<String, MidEntry> = mapOf(
    "201" to MidEntry("AL", "ALB", "", "Albania"),
    "202" to MidEntry("AD", "AND", "", "Andorra"),
    "203" to MidEntry("AT", "AUT", "", "Austria"),
    // ... ~290 entries ...
    "775" to MidEntry("VE", "VEN", "", "Venezuela"),
)
```

### Task 3: Cập nhật `ShipEnricher`

**File**: `service-processing/src/main/kotlin/com/tracking/processing/enrich/ShipEnricher.kt`

```kotlin
public class ShipEnricher(
    private val midCountryResolver: MidCountryResolver = MidCountryResolver(),
) {
    public fun enrich(ship: CanonicalShip, isHistorical: Boolean): EnrichedShip {
        return EnrichedShip(
            // ...existing field mapping...
            metadata = buildMetadata(ship),
        )
    }

    private fun buildMetadata(ship: CanonicalShip): ShipMetadata {
        val countryInfo = midCountryResolver.resolve(ship.mmsi)
        val shipTypeName = ship.vesselType?.replaceFirstChar {
            if (it.isLowerCase()) it.titlecase() else it.toString()
        }

        return ShipMetadata(
            flagCountry = countryInfo?.countryName,
            flagUrl = countryInfo?.flagUrl,
            shipTypeName = shipTypeName,
            isMilitary = false, // Future: detect military vessels
        )
    }
}
```

**Thay đổi quan trọng**:
- `buildMetadata()` luôn trả về `ShipMetadata` (không trả `null` nữa) → đảm bảo metadata luôn có, dù vesselType hay mmsi có null.
- Resolve country từ MMSI MID.
- Giữ nguyên logic title-case `vesselType`.

### Task 4: Unit Tests

**File mới**: `service-processing/src/test/kotlin/com/tracking/processing/enrich/MidCountryResolverTest.kt`

```kotlin
class MidCountryResolverTest {
    private val resolver = MidCountryResolver()

    @Test
    fun `should resolve Vietnam from MMSI starting with 574`() {
        val result = resolver.resolve("574123456")
        assertNotNull(result)
        assertEquals("VN", result.countryCode)
        assertEquals("Viet Nam", result.countryName)
        assertNotNull(result.flagUrl)
    }

    @Test
    fun `should resolve Panama from MMSI starting with 351`() { ... }

    @Test
    fun `should return null for invalid MMSI`() {
        assertNull(resolver.resolve(""))
        assertNull(resolver.resolve("12345"))       // too short
        assertNull(resolver.resolve("1234567890"))   // too long
        assertNull(resolver.resolve("abc123456"))    // non-numeric
    }

    @Test
    fun `should return null for unknown MID`() {
        assertNull(resolver.resolve("999000000"))
    }
}
```

**File mới**: `service-processing/src/test/kotlin/com/tracking/processing/enrich/ShipEnricherTest.kt`

```kotlin
class ShipEnricherTest {
    private val enricher = ShipEnricher()

    @Test
    fun `should enrich with flag country from MMSI`() {
        val ship = CanonicalShip(mmsi = "574123456", ...)
        val result = enricher.enrich(ship, isHistorical = false)

        assertEquals("Viet Nam", result.metadata?.flagCountry)
        assertNotNull(result.metadata?.flagUrl)
    }

    @Test
    fun `should enrich with ship type name when vesselType present`() { ... }

    @Test
    fun `should return metadata even when vesselType is null`() {
        val ship = CanonicalShip(mmsi = "574123456", vesselType = null, ...)
        val result = enricher.enrich(ship, isHistorical = false)

        assertNotNull(result.metadata)  // Trước đây trả null!
        assertEquals("Viet Nam", result.metadata?.flagCountry)
    }
}
```

### Task 5: Backfill dữ liệu hiện có trong DB (Optional)

Dữ liệu Ship đã lưu trong `ship_positions` chưa có `flag_country` trong metadata JSONB. Có thể xử lý bằng SQL migration:

**File**: `service-storage/src/main/resources/db/migration/V6__backfill_ship_flag_country.sql`

```sql
-- Backfill flag_country for existing ship positions using MMSI MID lookup
-- This is a one-time migration; new data will be enriched by ShipEnricher

WITH mid_countries(mid, country_name, flag_url) AS (
    VALUES
        ('201', 'Albania', 'https://flagcdn.com/h80/al.png'),
        ('211', 'Germany', 'https://flagcdn.com/h80/de.png'),
        ('574', 'Viet Nam', 'https://flagcdn.com/h80/vn.png')
        -- ... full list from mids.json ...
)
UPDATE ship_positions sp
SET metadata = COALESCE(sp.metadata, '{}'::jsonb)
    || jsonb_build_object(
        'flag_country', mc.country_name,
        'flag_url', mc.flag_url
    )
FROM mid_countries mc
WHERE LEFT(sp.mmsi, 3) = mc.mid
  AND (sp.metadata IS NULL OR sp.metadata->>'flag_country' IS NULL);
```

> **Lưu ý**: Migration backfill nên chạy off-peak, có thể rất chậm nếu bảng lớn. Cân nhắc chạy batch.

### Task 6: Frontend — Không cần thay đổi

Frontend đã sẵn sàng:
- `ShipDetailPanel.tsx` hiển thị `ship.metadata?.flagCountry` ở trường "Flag"
- `shipTypes.ts` map `flag_country` → `flagCountry`, `flag_url` → `flagUrl`
- Khi backend populate các trường này, UI sẽ tự động hiển thị.

---

## Tổng kết file cần thay đổi

| # | File | Action | Module |
|---|------|--------|--------|
| 1 | `service-processing/.../enrich/MidCountryResolver.kt` | **Tạo mới** | service-processing |
| 2 | `service-processing/.../enrich/ShipEnricher.kt` | **Sửa** — inject MidCountryResolver, update buildMetadata | service-processing |
| 3 | `service-processing/.../enrich/MidCountryResolverTest.kt` | **Tạo mới** | service-processing |
| 4 | `service-processing/.../enrich/ShipEnricherTest.kt` | **Tạo mới** | service-processing |
| 5 | `service-storage/.../V6__backfill_ship_flag_country.sql` | **Tạo mới** (optional) | service-storage |

**Không cần thay đổi**: `common-dto`, `service-ingestion`, `service-storage` (writer), `frontend-ui`, Kafka topics.

---

## Trình tự thực hiện

```
1. Tạo MidCountryResolverTest     ← test first
2. Tạo MidCountryResolver          ← implement
3. Tạo ShipEnricherTest            ← test first  
4. Sửa ShipEnricher                ← enrich with flag
5. Chạy tests                      ← verify
6. (Optional) Tạo backfill SQL     ← migrate existing data
7. apiCheck                        ← verify public API
```

---

## Lưu ý kỹ thuật

- **MMSI đặc biệt**: Một số MMSI không theo chuẩn 9 chữ số (coast stations, SAR aircraft, AIS aids to navigation). Resolver nên gracefully return `null` cho các trường hợp này.
- **Flag CDN**: Dùng `https://flagcdn.com/h80/{iso2}.png` — consistent với `IcaoCountryResolver` cho aircraft.
- **Performance**: `MID_TABLE` là `Map<String, MidEntry>` — O(1) lookup, không ảnh hưởng throughput.
- **Backward compatible**: `ShipMetadata` không thay đổi, chỉ populate thêm field → không break API.
