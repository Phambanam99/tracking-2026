# Frontend Map Features – Implementation Plan

> **Date:** 2026-03-01  
> **Stack hiện tại:** React 18 + TypeScript + Vite + Tailwind CSS + STOMP WebSocket  
> **Map library:** OpenLayers (ol) – sẽ thêm mới  
> **State management:** Zustand (lightweight, đã dùng pattern tương tự trong useAuthStore)

---

## Tổng quan kiến trúc

```
src/
├── features/
│   ├── map/                          # ← Map core (shared giữa aircraft & ship)
│   │   ├── components/
│   │   │   ├── MapContainer.tsx       # OL map instance, layer management
│   │   │   ├── MapToolbar.tsx         # Toolbar: draw, measure, search toggle
│   │   │   └── MapStatusBar.tsx       # Hiển thị tọa độ chuột, zoom level
│   │   ├── context/
│   │   │   └── MapContext.tsx          # React context chia sẻ OL Map instance
│   │   ├── hooks/
│   │   │   ├── useOlMap.ts            # Khởi tạo & quản lý OL Map
│   │   │   └── useMapViewport.ts      # Sync viewport (extent) ↔ state
│   │   ├── layers/
│   │   │   └── baseLayer.ts           # Tile layers (OSM, satellite, v.v.)
│   │   └── types/
│   │       └── mapTypes.ts            # Shared map types
│   │
│   ├── aircraft/                      # ← TÁCH RIÊNG cho máy bay
│   │   ├── components/
│   │   │   ├── AircraftMapLayer.tsx    # OL Vector layer cho máy bay
│   │   │   ├── AircraftPopup.tsx       # Popup khi click vào icon máy bay
│   │   │   ├── AircraftRouteLayer.tsx  # Layer hiển thị route lịch sử
│   │   │   └── AircraftInfoPanel.tsx   # Side panel thông tin chi tiết
│   │   ├── hooks/
│   │   │   ├── useAircraftSocket.ts    # STOMP WebSocket (refactor từ useFlightSocket)
│   │   │   └── useAircraftHistory.ts   # Fetch lịch sử bay
│   │   ├── store/
│   │   │   └── useAircraftStore.ts     # Zustand store cho aircraft data
│   │   ├── render/
│   │   │   ├── aircraftStyle.ts        # OL Style, dùng SVG từ tar1090 markers.js
│   │   │   └── routeStyle.ts           # OL Style cho route line
│   │   ├── db/                          # ← Aircraft database (từ tar1090-db)
│   │   │   ├── markers.ts              # 80+ SVG shape paths (port từ tar1090 markers.js)
│   │   │   ├── typeDesignatorIcons.ts  # ICAO type → shape mapping (B738→b737, A320→a320…)
│   │   │   ├── icaoRanges.ts           # ICAO hex → country/country_code (port từ flags.js)
│   │   │   ├── registrations.ts        # ICAO hex → registration (port từ registrations.js)
│   │   │   ├── aircraftDb.ts           # Lazy-load tar1090-db sharded DB (db/0.js…F.js)
│   │   │   └── iconResolver.ts         # getBaseMarker() logic: type→desc→category→default
│   │   └── types/
│   │       └── aircraftTypes.ts        # Aircraft-specific types
│   │
│   ├── ship/                          # ← Placeholder cho tàu thuyền (tương lai)
│   │   └── README.md                   # "Planned – same pattern as aircraft/"
│   │
│   ├── drawing/                       # ← Vẽ hình, đo khoảng cách
│   │   ├── components/
│   │   │   ├── DrawToolPanel.tsx       # UI chọn loại hình vẽ
│   │   │   ├── MeasureTool.tsx         # Đo khoảng cách 2 điểm
│   │   │   └── DrawingOverlay.tsx      # Hiển thị tooltip khi vẽ
│   │   ├── hooks/
│   │   │   ├── useDrawInteraction.ts   # OL Draw interaction (circle, rect, polygon)
│   │   │   └── useMeasureInteraction.ts # OL interaction đo khoảng cách
│   │   ├── store/
│   │   │   └── useDrawingStore.ts      # Lưu trữ các shape đã vẽ
│   │   └── types/
│   │       └── drawingTypes.ts         # Drawing types (DrawShape, MeasureResult)
│   │
│   ├── monitoring/                    # ← Vùng theo dõi (geofence)
│   │   ├── components/
│   │   │   ├── MonitoringZonePanel.tsx  # Quản lý danh sách vùng theo dõi
│   │   │   ├── MonitoringZoneLayer.tsx  # OL layer hiển thị vùng
│   │   │   └── MonitoringAlertList.tsx  # Hiển thị thông báo bay vào/ra
│   │   ├── hooks/
│   │   │   └── useGeofenceCheck.ts     # Logic kiểm tra aircraft in/out zone
│   │   ├── store/
│   │   │   └── useMonitoringStore.ts   # Store vùng theo dõi + alerts
│   │   └── types/
│   │       └── monitoringTypes.ts
│   │
│   ├── search/                        # ← Tìm kiếm
│   │   ├── components/
│   │   │   ├── SearchBar.tsx           # Search bar trên map page
│   │   │   ├── SearchPanel.tsx         # Panel kết quả tìm kiếm
│   │   │   ├── AdvancedSearchForm.tsx  # Form tìm kiếm nâng cao (lịch sử)
│   │   │   └── SearchResultList.tsx    # Danh sách kết quả
│   │   ├── hooks/
│   │   │   └── useSearchAircraft.ts    # API calls tìm kiếm
│   │   ├── store/
│   │   │   └── useSearchStore.ts       # Store kết quả & filters
│   │   └── types/
│   │       └── searchTypes.ts
│   │
│   └── watchlist/                     # ← Danh sách theo dõi
│       ├── components/
│       │   ├── WatchlistPanel.tsx       # Panel danh sách theo dõi
│       │   ├── WatchlistGroupCard.tsx   # Card cho mỗi nhóm theo dõi
│       │   ├── WatchlistAircraftRow.tsx # Row cho mỗi aircraft trong nhóm
│       │   └── WatchlistMapToggle.tsx   # Toggle hiển thị/ẩn group trên map
│       ├── hooks/
│       │   └── useWatchlistSync.ts     # Sync watchlist ↔ backend
│       ├── store/
│       │   └── useWatchlistStore.ts    # Zustand store
│       └── types/
│           └── watchlistTypes.ts
│
└── shared/
    ├── api/
    │   └── httpClient.ts               # (đã có)
    ├── components/
    │   ├── Panel.tsx                    # Reusable slide panel
    │   └── Tooltip.tsx                  # Reusable tooltip
    └── utils/
        ├── geoUtils.ts                 # Coordinate transforms, distance calc
        └── formatUtils.ts              # Hiển thị số liệu
```

---

## Phases & Tasks

### Phase –1 – Backend Enrichment (service-processing)

> **Tiên quyết cho frontend:** backend phải gửi `AircraftMetadata` đầy đủ (countryCode, aircraftType, registration, operator) trước khi frontend render được icon + popup đúng.

| #    | Task                                        | File                                               | Trạng thái |
| ---- | ------------------------------------------- | -------------------------------------------------- | ---------- |
| -1.1 | Mở rộng `IcaoCountryResolver`               | `service-processing/…/IcaoCountryResolver.kt`      | ✅         |
| -1.2 | Tạo `IcaoRegistrationResolver`              | `service-processing/…/IcaoRegistrationResolver.kt` | ✅         |
| -1.3 | Implement `CsvReferenceDataLoader`          | `service-processing/…/CsvReferenceDataLoader.kt`   | ✅         |
| -1.4 | Cập nhật `FlightEnricher`                   | Dùng registration resolver làm fallback            | ✅         |
| -1.5 | Wire beans trong `ProcessingConsumerConfig` | Thêm `IcaoRegistrationResolver` + đổi loader       | ✅         |
| -1.6 | Tests pass                                  | Unit tests cho mọi class mới                       | ✅         |

**Kết quả:** Frontend nhận `EnrichedFlight.metadata` với `countryCode`, `aircraftType`, `registration`, `operator` → hiển thị popup đầy đủ + chọn đúng SVG icon.

**Icon resolution vẫn ở Frontend** – backend chỉ cần gửi `aircraftType` (e.g. `"A321"`). Frontend dùng `typeDesignatorIcons["A321"] → "a320"` → SVG path từ `markers.ts`.

---

### Phase 0 – Foundation (Dependencies & Map Core)

| #   | Task                                         | Mô tả                                                        | Ưu tiên |
| --- | -------------------------------------------- | ------------------------------------------------------------ | ------- |
| 0.1 | Install dependencies                         | `ol`, `zustand`, `@types/ol` (nếu cần)                       | P0      |
| 0.2 | `MapContext` + `useOlMap`                    | Tạo OL Map instance, gắn vào div, expose qua Context         | P0      |
| 0.3 | `MapContainer.tsx`                           | Component chính chứa map div + MapContext.Provider           | P0      |
| 0.4 | `baseLayer.ts`                               | OSM tile layer (mặc định), có thể switch satellite           | P0      |
| 0.5 | `MapToolbar.tsx`                             | Toolbar placeholder (sẽ thêm buttons từng phase)             | P0      |
| 0.6 | `MapStatusBar.tsx`                           | Hiển thị tọa độ chuột, zoom level                            | P1      |
| 0.7 | Refactor `App.tsx`                           | Thay `MapView` cũ bằng `MapContainer` mới + layout full-page | P0      |
| 0.8 | **Tests:** Unit test `useOlMap`, `baseLayer` | Kiểm tra map init đúng, layer đúng                           | P0      |

**Dependencies cần install:**

```bash
npm install ol zustand
npm install -D @types/ol
```

---

### Phase 1 – Aircraft Layer (Tách riêng máy bay)

| #    | Task                                                                                     | Mô tả                                                                                                              | Ưu tiên |
| ---- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------- |
| 1.1  | `aircraftTypes.ts`                                                                       | Types: `Aircraft`, `AircraftPosition`, `AircraftTrack` + enrichment fields (country, flag, registration, operator) | P0      |
| 1.2  | `useAircraftStore.ts`                                                                    | Zustand store: live aircraft map, selected aircraft, enrichment cache                                              | P0      |
| 1.3  | Refactor `useFlightSocket` → `useAircraftSocket`                                         | Giữ STOMP logic, đổi tên, cập nhật store mới                                                                       | P0      |
| 1.4  | **Port tar1090 markers.js**                                                              | Chuyển 80+ SVG shape paths sang `db/markers.ts` (xem mục tar1090-db bên dưới)                                      | P0      |
| 1.5  | **Port tar1090 icon mappings**                                                           | `typeDesignatorIcons.ts`: TypeDesignator→shape, TypeDescription→shape, Category→shape                              | P0      |
| 1.6  | **`iconResolver.ts`**                                                                    | Port `getBaseMarker()` logic: addrtype → TypeDesignator → TypeDescription+WTC → Category → default                 | P0      |
| 1.7  | `aircraftStyle.ts`                                                                       | OL Style: `iconResolver` → SVG → data:image URI → `ol/style/Icon`, xoay theo heading, màu theo altitude            | P0      |
| 1.8  | **Port `icaoRanges.ts`**                                                                 | Chuyển ICAO_Ranges + `findICAORange()` từ tar1090 `flags.js` → lookup country/country_code từ ICAO hex             | P0      |
| 1.9  | **Port `registrations.ts`**                                                              | Chuyển `registration_from_hexid()` từ tar1090 `registrations.js` → tính registration từ ICAO hex                   | P1      |
| 1.10 | **`aircraftDb.ts`**                                                                      | Lazy-load tar1090-db sharded DB files → enrich aircraft (type, operator, registration fallback)                    | P1      |
| 1.11 | `AircraftMapLayer.tsx`                                                                   | OL VectorLayer + VectorSource, sync từ store, update features                                                      | P0      |
| 1.12 | `AircraftPopup.tsx`                                                                      | OL Overlay popup: ICAO, callsign, country flag 🇻🇳, registration, altitude, speed, heading                          | P0      |
| 1.13 | Click interaction                                                                        | Click vào feature → hiển thị popup, highlight aircraft                                                             | P0      |
| 1.14 | Hover interaction                                                                        | Hover → change cursor, tooltip với ICAO + callsign                                                                 | P1      |
| 1.15 | **Tests:** Store, socket adapter, iconResolver, icaoRanges, style function, popup render |                                                                                                                    | P0      |

**Popup hiển thị:**

```
┌──────────────────────────────────┐
│ 🇻🇳 ✈ VN-A321  (Vietnam Airlines) │
├──────────────────────────────────┤
│ ICAO:         780A3B               │
│ Registration: VN-A321              │
│ Callsign:     VNA321               │
│ Type:         A321 (L2J)           │
│ Country:      Viet Nam 🇻🇳          │
│ Operator:     Vietnam Airlines     │
│ Altitude:     35,000 ft            │
│ Speed:        480 kts              │
│ Heading:      125°                 │
│ Position:     21.0285°N 105.8542°E │
├──────────────────────────────────┤
│ [📍 Follow]  [📜 History]         │
│ [➕ Add to watchlist ▾]           │
└──────────────────────────────────┘
```

---

### Appendix 1A – Tích hợp tar1090-db (Aircraft Icons & Enrichment)

> **Nguồn dữ liệu:**
>
> - [`wiedehopf/tar1090`](https://github.com/wiedehopf/tar1090) – Front-end ADS-B tracker
> - [`wiedehopf/tar1090-db`](https://github.com/wiedehopf/tar1090-db) – Aircraft database (maintained by Mictronics)

#### 1A.1 – Aircraft SVG Icons (`db/markers.ts`)

Port **80+ SVG shape paths** từ tar1090 `html/markers.js`. Mỗi shape là 1 SVG path string + viewBox size. Ví dụ:

```typescript
// db/markers.ts
export const AircraftShapes: Record<
  string,
  { path: string; viewBox: number; defaultScale: number }
> = {
  a320: { path: "M 48 ...", viewBox: 96, defaultScale: 1.0 },
  b737: { path: "M 50 ...", viewBox: 96, defaultScale: 1.0 },
  b747: { path: "M 48 ...", viewBox: 96, defaultScale: 1.2 },
  cessna: { path: "M 48 ...", viewBox: 96, defaultScale: 0.72 },
  helicopter: { path: "M 48 ...", viewBox: 96, defaultScale: 0.72 },
  hi_perf: { path: "M 48 ...", viewBox: 96, defaultScale: 0.7 },
  ground: { path: "M 48 ...", viewBox: 96, defaultScale: 0.6 },
  // ... 80+ shapes
};
```

**Danh sách shapes chính (nhóm theo loại):**

| Nhóm       | Shapes                                                                                |
| ---------- | ------------------------------------------------------------------------------------- |
| Airbus     | `a220`, `a319`, `a320`, `a321`, `a330`, `a340`, `a350`, `a380`                        |
| Boeing     | `b737`, `b747`, `b757`, `b767`, `b777`, `b787`                                        |
| Regional   | `crj_series`, `erj_135`, `erj_175`, `e170`                                            |
| Turboprop  | `dash_8`, `atr`, `saab`, `beech_1900`, `king_air`                                     |
| Light      | `cessna`, `citation`, `pa28`, `pa44`, `learjet`, `sr22`                               |
| Military   | `hi_perf`, `f15`, `f16`, `f18`, `eurofighter`, `b1`, `b2`, `b52`, `c130`, `c17`, `c5` |
| Helicopter | `helicopter`, `s76`                                                                   |
| Other      | `balloon`, `ulm`, `gyrocopter`, `glider`, `ground`, `tower`, `unknown`                |

#### 1A.2 – Icon Resolution Logic (`db/iconResolver.ts`)

Port `getBaseMarker()` từ tar1090 – logic chọn SVG shape phù hợp theo thứ tự ưu tiên:

```
1. addrtype → nếu "adsb_icao_nt" → "ground_unknown"
2. TypeDesignatorIcons[typeDesignator] → e.g. "B738" → ["b737", 1.0]
3. TypeDescriptionIcons[typeDescription + wtc] → e.g. "L2J" → ["jet_swept"]
4. CategoryIcons[category] → e.g. "A3" → ["jet_swept", 1.5]
5. Default → "unknown"
```

```typescript
// db/iconResolver.ts
import { TypeDesignatorIcons } from "./typeDesignatorIcons";
import { TypeDescriptionIcons, CategoryIcons } from "./typeDesignatorIcons";
import { AircraftShapes } from "./markers";

export interface ResolvedIcon {
  shapeName: string;
  scale: number;
  svgPath: string;
  viewBox: number;
}

export function resolveAircraftIcon(aircraft: {
  typeDesignator?: string; // "B738", "A320"
  typeDescription?: string; // "L2J", "L1P"
  wtc?: string; // "L", "M", "H"
  category?: string; // "A1"..."A7", "B1"..."B6", "C0"..."C3"
  addrtype?: string;
}): ResolvedIcon {
  /* ... */
}
```

**typeDesignatorIcons.ts** – Mapping ví dụ (hàng trăm entries):

```typescript
// ICAO type designator → [shapeName, scale]
export const TypeDesignatorIcons: Record<string, [string, number]> = {
  A318: ["a319", 0.97],
  A319: ["a319", 1.0],
  A320: ["a320", 1.0],
  A321: ["a320", 1.04],
  A332: ["a330", 1.02],
  A333: ["a330", 1.08],
  A388: ["a380", 1.0],
  B737: ["b737", 0.96],
  B738: ["b737", 1.0],
  B739: ["b737", 1.04],
  B744: ["b747", 1.0],
  B77L: ["b777", 1.0],
  B77W: ["b777", 1.04],
  B789: ["b787", 1.0],
  C172: ["cessna", 0.72],
  EC35: ["helicopter", 0.72],
  // ... hàng trăm entries khác
};

// Type description (ICAO doc8643) → [shapeName, scale?]
export const TypeDescriptionIcons: Record<string, [string, number?]> = {
  L1P: ["cessna"],
  L1T: ["cessna"],
  L2P: ["pa44"],
  L2J: ["jet_swept"],
  L4J: ["b747"],
  H2T: ["helicopter"],
  // ...
};

// ADS-B category → [shapeName, scale?]
export const CategoryIcons: Record<string, [string, number?]> = {
  A1: ["cessna", 0.72], // Light
  A2: ["jet_nonswept"], // Small
  A3: ["jet_swept", 1.5], // Large
  A4: ["hi_perf"], // High performance
  A5: ["b747", 1.5], // Heavy
  A7: ["helicopter"], // Rotorcraft
  B1: ["glider"], // Glider
  B2: ["balloon"], // Lighter than air
  C3: ["ground"], // Ground vehicle
  // ...
};
```

#### 1A.3 – SVG → OL Icon pipeline (`aircraftStyle.ts`)

Chuyển SVG shape path thành `ol/style/Icon`:

```typescript
// render/aircraftStyle.ts

function svgShapeToDataUri(
  icon: ResolvedIcon,
  options: {
    fillColor: string; // Màu theo altitude hoặc watchlist group
    strokeColor: string; // "#000"
    rotation: number; // heading in radians
    scale: number;
  },
): string {
  const { svgPath, viewBox } = icon;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBox} ${viewBox}">
    <path d="${svgPath}" fill="${options.fillColor}" stroke="${options.strokeColor}" stroke-width="0.5"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Sử dụng trong OL style:
new Style({
  image: new Icon({
    src: svgShapeToDataUri(resolvedIcon, {
      fillColor,
      strokeColor,
      rotation,
      scale,
    }),
    scale: resolvedIcon.scale * baseScale,
    rotation: headingInRadians,
    rotateWithView: true,
  }),
});
```

**Màu theo altitude (gradient):**

| Altitude    | Color                  |
| ----------- | ---------------------- |
| Ground (0)  | `#d4a017` (vàng đậm)   |
| < 5,000 ft  | `#ff8c00` (cam)        |
| < 15,000 ft | `#22c55e` (xanh lá)    |
| < 30,000 ft | `#3b82f6` (xanh dương) |
| < 40,000 ft | `#8b5cf6` (tím)        |
| > 40,000 ft | `#ef4444` (đỏ)         |

**Icon Cache:** Cache `ol/style/Style` instances theo key `{shape}_{color}_{heading_bucket}` để tránh tạo SVG mỗi frame. Heading bucket = Math.round(heading / 5) \* 5 (72 giá trị).

#### 1A.4 – ICAO → Country Lookup (`db/icaoRanges.ts`)

Port `ICAO_Ranges` + `findICAORange()` từ tar1090 `flags.js`:

```typescript
// db/icaoRanges.ts

interface ICAORange {
  start: number; // hex number, e.g. 0x780000
  end: number; // hex number, e.g. 0x7FFFFF
  country: string; // "Viet Nam"
  countryCode: string; // "vn" (ISO 3166-1 alpha-2, lowercase)
}

// ~200+ entries, sorted by start
export const ICAO_RANGES: ICAORange[] = [
  { start: 0x700000, end: 0x700fff, country: "Afghanistan", countryCode: "af" },
  // ...
  { start: 0x780000, end: 0x7bffff, country: "Viet Nam", countryCode: "vn" },
  // ...
  {
    start: 0xa00000,
    end: 0xafffff,
    country: "United States",
    countryCode: "us",
  },
  // ...
];

/**
 * Binary search ICAO hex → country info.
 * @param icaoHex - e.g. "780A3B"
 */
export function findICAORange(
  icaoHex: string,
): { country: string; countryCode: string } | null {
  const addr = parseInt(icaoHex, 16);
  // binary search trên ICAO_RANGES sorted by start
  // ...
}
```

**Hiển thị cờ quốc gia:** Dùng emoji flag từ `countryCode`:

```typescript
function countryCodeToFlag(cc: string): string {
  return cc
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}
// "vn" → "🇻🇳", "us" → "🇺🇸", "jp" → "🇯🇵"
```

#### 1A.5 – ICAO → Registration (`db/registrations.ts`)

Port `registration_from_hexid()` từ tar1090 `registrations.js`. Algorithm tính registration number từ ICAO hex **không cần DB lookup** — dùng reverse math:

| Country       | Prefix | Algorithm                                                          |
| ------------- | ------ | ------------------------------------------------------------------ |
| United States | N      | Decode 24-bit ICAO → N-number (A00001→N1, AF7960→N99999)           |
| Japan         | JA     | Simple offset mapping từ hex range                                 |
| South Korea   | HL     | Simple offset mapping                                              |
| EU countries  | Varied | **Stride mapping**: step through hex ranges, map to digits/letters |
| Others        | -      | Cần DB lookup (không có algorithmic decode)                        |

```typescript
// db/registrations.ts

export function registrationFromHexId(icaoHex: string): string | null {
  const hexId = parseInt(icaoHex, 16);
  // US N-number (0xA00001 - 0xAFFFFF)
  if (hexId >= 0xa00001 && hexId <= 0xadf7c7) {
    return decodeNNumber(hexId);
  }
  // Japan JA (0x840000 - 0x87FFFF)
  if (hexId >= 0x840000 && hexId <= 0x87ffff) {
    return decodeJapan(hexId);
  }
  // South Korea HL (0x710000 - 0x717FFF)
  // EU stride mappings (France F-, Germany D-, UK G-, etc.)
  // ...
  return null; // → cần fallback sang aircraftDb lookup
}
```

#### 1A.6 – Aircraft Database (`db/aircraftDb.ts`)

Lazy-load tar1090-db sharded database files cho enrichment:

**Cấu trúc tar1090-db:**

- `db/0.js` ... `db/F.js`: 16 shard files, mỗi file chứa aircraft data theo hex prefix đầu
- Mỗi entry: `icaoHex → [registration, typeDesignator, typeDescription, operatorIcao, ...]`
- `db/operators.js`: Operator ICAO → airline name
- `db/icao_aircraft_types.js`: Type designator → `{desc, wtc}`
- `db/ranges.js`: Military ICAO hex ranges

```typescript
// db/aircraftDb.ts

interface AircraftDbEntry {
  registration: string;
  typeDesignator: string; // "B738"
  typeDescription: string; // "L2J"
  operatorIcao: string; // "VNA"
  operatorName?: string; // "Vietnam Airlines" (từ operators.js)
  wtc?: string; // "M" (từ icao_aircraft_types)
  isMilitary?: boolean; // true nếu ICAO trong military ranges
}

// Cache đã load shards
const loadedShards = new Map<string, Map<string, AircraftDbEntry>>();

/**
 * Lazy-load shard file cho ICAO hex prefix rồi lookup.
 * Shard file: `/assets/db/{prefix}.js` (bundled hoặc fetched)
 */
export async function lookupAircraft(
  icaoHex: string,
): Promise<AircraftDbEntry | null> {
  const prefix = icaoHex.charAt(0).toUpperCase(); // "7" → shard "7.js"
  if (!loadedShards.has(prefix)) {
    const data = await fetchShard(prefix);
    loadedShards.set(prefix, data);
  }
  return loadedShards.get(prefix)?.get(icaoHex.toUpperCase()) ?? null;
}
```

**Loading strategy:**

1. Chuyển tar1090-db `.js` files → JSON (strip JS wrapper) → đặt vào `public/db/`
2. Lazy-load shard khi gặp aircraft hex prefix chưa có trong cache
3. Mỗi shard ~200-500KB raw, nén gzip ~50-100KB
4. `icao_aircraft_types.json` + `operators.json` → load 1 lần khi init

**Enrichment pipeline (mỗi khi nhận aircraft mới):**

```
ICAO hex "780A3B"
     │
     ├──→ findICAORange("780A3B")                    → { country: "Viet Nam", countryCode: "vn" }
     ├──→ registrationFromHexId("780A3B")            → null (VN không có algorithmic decode)
     ├──→ lookupAircraft("780A3B")                   → { registration: "VN-A321", type: "A321", ... }
     │         ├── typeDesignator "A321"
     │         ├── registration "VN-A321" (fallback từ DB)
     │         └── operatorIcao "HVN" → "Vietnam Airlines"
     │
     └──→ resolveAircraftIcon({ typeDesignator: "A321" }) → { shapeName: "a320", scale: 1.04 }
```

---

### Phase 2 – Drawing Tools (Vẽ hình trên Map)

| #   | Task                                                               | Mô tả                                                            | Ưu tiên |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------- | ------- |
| 2.1 | `drawingTypes.ts`                                                  | Types: `DrawShape` (circle, rect, polygon), `DrawnArea`          | P0      |
| 2.2 | `useDrawingStore.ts`                                               | Store: drawnShapes[], activeDrawType, selectedShape              | P0      |
| 2.3 | `useDrawInteraction.ts`                                            | OL Draw interaction cho Circle, Box (RegularShape), Polygon      | P0      |
| 2.4 | `DrawToolPanel.tsx`                                                | UI buttons: Circle, Rectangle, Polygon, Clear, Cancel            | P0      |
| 2.5 | Drawing layer                                                      | VectorLayer riêng cho shapes đã vẽ, style khác biệt              | P0      |
| 2.6 | Area search – hiện tại                                             | Sau khi vẽ xong → filter aircraft trong store theo geometry      | P0      |
| 2.7 | Area search – lịch sử                                              | Sau khi vẽ → gửi geometry + time range lên API, hiển thị kết quả | P1      |
| 2.8 | Edit/Delete shapes                                                 | Modify interaction, right-click menu hoặc toolbar                | P1      |
| 2.9 | **Tests:** Drawing store, geometry filter logic, interaction hooks |                                                                  | P0      |

**Drawing modes:**

- **Circle:** Click center → drag radius
- **Rectangle:** Click corner → drag opposite corner (sử dụng `ol/interaction/Draw` với `createBox()`)
- **Polygon:** Click từng điểm → double-click kết thúc
- **Square:** Rectangle với constraint tỷ lệ 1:1

---

### Phase 3 – Measure Tool (Đo khoảng cách)

| #   | Task                                                          | Mô tả                                                        | Ưu tiên |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------ | ------- |
| 3.1 | `useMeasureInteraction.ts`                                    | OL Draw type=LineString, tính distance on-the-fly            | P0      |
| 3.2 | `MeasureTool.tsx`                                             | Toggle measure mode, hiển thị tooltip khoảng cách            | P0      |
| 3.3 | `geoUtils.ts`                                                 | `haversineDistance(p1, p2)`: tính khoảng cách trên ellipsoid | P0      |
| 3.4 | Overlay tooltip                                               | Hiển thị khoảng cách (km/nm) tại điểm giữa 2 điểm            | P0      |
| 3.5 | Multi-segment measure                                         | Cho phép đo nhiều đoạn liên tiếp, tổng khoảng cách           | P1      |
| 3.6 | **Tests:** `haversineDistance` unit test, measure interaction |                                                              | P0      |

---

### Phase 4 – Monitoring Zones (Vùng theo dõi & Cảnh báo)

| #    | Task                                                              | Mô tả                                                               | Ưu tiên |
| ---- | ----------------------------------------------------------------- | ------------------------------------------------------------------- | ------- |
| 4.1  | `monitoringTypes.ts`                                              | `MonitoringZone`, `GeofenceAlert` (enter/exit, timestamp, aircraft) | P0      |
| 4.2  | `useMonitoringStore.ts`                                           | Store: zones[], alerts[], active zone IDs                           | P0      |
| 4.3  | "Save as monitoring zone"                                         | Từ drawn shape → chuyển thành monitoring zone (tên, màu)            | P0      |
| 4.4  | `MonitoringZoneLayer.tsx`                                         | OL layer hiển thị zones với style riêng (viền đậm, fill mờ)         | P0      |
| 4.5  | `useGeofenceCheck.ts`                                             | Mỗi frame: check aircraft positions vs zone geometries              | P0      |
| 4.6  | `MonitoringAlertList.tsx`                                         | Notification list: aircraft X entered/exited zone Y at time Z       | P0      |
| 4.7  | `MonitoringZonePanel.tsx`                                         | CRUD panel: list zones, toggle visibility, rename, delete           | P1      |
| 4.8  | Alert notification                                                | Toast/sound khi có aircraft vào/ra zone                             | P1      |
| 4.9  | Persist zones                                                     | Lưu zones vào localStorage hoặc backend API                         | P2      |
| 4.10 | **Tests:** Geofence check logic (point-in-polygon), store, alerts |                                                                     | P0      |

**Geofence check algorithm:**

- Sử dụng `ol/geom/Geometry.intersectsCoordinate()` cho mỗi zone
- So sánh state trước/sau để phát hiện ENTER/EXIT
- Throttle check mỗi 1-2 giây (không cần mỗi frame)

---

### Phase 5 – Search (Tìm kiếm)

| #    | Task                                                    | Mô tả                                                                   | Ưu tiên |
| ---- | ------------------------------------------------------- | ----------------------------------------------------------------------- | ------- |
| 5.1  | `searchTypes.ts`                                        | `SearchMode` (viewport/global/history), `SearchFilters`, `SearchResult` | P0      |
| 5.2  | `useSearchStore.ts`                                     | Store: query, mode, filters, results[], loading                         | P0      |
| 5.3  | `SearchBar.tsx`                                         | Input bar trên cùng map page, toggle search mode                        | P0      |
| 5.4  | Search – current viewport                               | Filter aircraft trong store theo ICAO/callsign match                    | P0      |
| 5.5  | Search – toàn bản đồ                                    | API call `/api/aircraft/search?q=...` → kết quả + zoom to               | P0      |
| 5.6  | `AdvancedSearchForm.tsx`                                | Form lịch sử: ICAO, callsign, time range, altitude range, area          | P0      |
| 5.7  | Search – lịch sử                                        | API call `/api/aircraft/history/search` → kết quả                       | P0      |
| 5.8  | `SearchResultList.tsx`                                  | List kết quả, click → zoom to aircraft trên map                         | P0      |
| 5.9  | `SearchPanel.tsx`                                       | Container panel: search bar + mode tabs + results                       | P0      |
| 5.10 | Highlight on map                                        | Kết quả tìm kiếm highlight trên map (khác style)                        | P1      |
| 5.11 | **Tests:** Search store, filter logic, component render |                                                                         | P0      |

**Search modes:**

| Mode         | Input                                             | Source                                    | Action                    |
| ------------ | ------------------------------------------------- | ----------------------------------------- | ------------------------- |
| Current View | ICAO/callsign                                     | In-memory store (aircraft trong viewport) | Filter & highlight        |
| Global       | ICAO/callsign                                     | Backend API                               | Fetch, zoom to, highlight |
| History      | ICAO, callsign, time range, altitude, speed, area | Backend API                               | Fetch & display results   |

**Advanced Search Fields:**

- ICAO (text)
- Callsign (text)
- Registration (text)
- Aircraft type (dropdown)
- Time range: from → to (datetime picker)
- Altitude range: min → max (ft)
- Speed range: min → max (kts)
- Area: bounding box hoặc drawn polygon
- Source (multi-select: ADS-B Exchange, FR24, RadarBox)

---

### Phase 6 – Watchlist (Danh sách theo dõi)

| #    | Task                                               | Mô tả                                                              | Ưu tiên |
| ---- | -------------------------------------------------- | ------------------------------------------------------------------ | ------- |
| 6.1  | `watchlistTypes.ts`                                | `WatchlistGroup`, `WatchlistEntry` (aircraft → nhiều groups)       | P0      |
| 6.2  | `useWatchlistStore.ts`                             | Store: groups[], entries Map<icao, groupIds[]>                     | P0      |
| 6.3  | "Follow" button in popup                           | Từ AircraftPopup → add aircraft to default watchlist               | P0      |
| 6.4  | "Add to watchlist" dropdown                        | Chọn group cụ thể hoặc tạo group mới                               | P0      |
| 6.5  | `WatchlistPanel.tsx`                               | Side panel: list groups, expand → list aircraft, toggle visibility | P0      |
| 6.6  | `WatchlistGroupCard.tsx`                           | Card cho mỗi group: tên, màu, số lượng, toggle map                 | P0      |
| 6.7  | `WatchlistMapToggle.tsx`                           | Toggle hiển thị 1 hoặc nhiều groups trên map                       | P0      |
| 6.8  | Watchlist layer on map                             | Highlight aircraft thuộc visible watchlists (màu theo group)       | P0      |
| 6.9  | Drag & drop aircraft giữa groups                   | Tùy chọn, nâng cao UX                                              | P2      |
| 6.10 | Persist watchlist                                  | localStorage + optional backend sync                               | P1      |
| 6.11 | **Tests:** Store (add/remove/toggle), panel render |                                                                    | P0      |

**Data model:**

```typescript
type WatchlistGroup = {
  id: string;
  name: string;
  color: string; // Hex color cho marker trên map
  createdAt: number;
  visibleOnMap: boolean; // Toggle hiển thị group trên map
};

type WatchlistEntry = {
  icao: string;
  callsign?: string;
  groupIds: string[]; // 1 aircraft thuộc nhiều groups
  addedAt: number;
  note?: string;
};
```

---

### Phase 7 – Route History (Lịch sử đường bay)

| #   | Task                                               | Mô tả                                                          | Ưu tiên |
| --- | -------------------------------------------------- | -------------------------------------------------------------- | ------- |
| 7.1 | `useAircraftHistory.ts`                            | API: `GET /api/aircraft/{icao}/history?from=&to=`              | P0      |
| 7.2 | `AircraftRouteLayer.tsx`                           | OL VectorLayer: LineString cho route, markers cho điểm         | P0      |
| 7.3 | `routeStyle.ts`                                    | Gradient line style (cũ → mới), point markers tại mỗi position | P0      |
| 7.4 | "Show History" button                              | Từ popup → fetch & render route trên map                       | P0      |
| 7.5 | Time slider                                        | Slider chọn time range cho route display                       | P1      |
| 7.6 | Route animation                                    | Animate aircraft icon di chuyển theo route (playback)          | P2      |
| 7.7 | Multi-route display                                | Hiển thị route nhiều aircraft cùng lúc (khác màu)              | P1      |
| 7.8 | **Tests:** History API hook, route layer rendering |                                                                | P0      |

---

### Phase 8 – Polish & Advanced Features

| #   | Task                     | Mô tả                                                    | Ưu tiên |
| --- | ------------------------ | -------------------------------------------------------- | ------- |
| 8.1 | Cluster layer            | Cluster aircraft icons khi zoom out nhiều                | P1      |
| 8.2 | Layer control panel      | Toggle on/off: aircraft, routes, zones, watchlists       | P1      |
| 8.3 | Map style switcher       | OSM / Satellite / Dark / Topo                            | P1      |
| 8.4 | Keyboard shortcuts       | Esc = cancel draw, M = measure, F = fullscreen           | P2      |
| 8.5 | Responsive layout        | Mobile-friendly panel collapse                           | P2      |
| 8.6 | Performance optimization | WebGL renderer cho >10k aircraft, worker offload         | P2      |
| 8.7 | Export functions         | Export drawn areas as GeoJSON, export search results CSV | P2      |

---

## Page Layout Design

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Tracking 2026  │ Search Bar [________________] 🔍  │  User ▾
├────┬────────────────────────────────────────────────┬───────┤
│    │                                                │       │
│ S  │                                                │  W    │
│ i  │                                                │  a    │
│ d  │              OpenLayers Map                    │  t    │
│ e  │           (full height/width)                  │  c    │
│    │                                                │  h    │
│ P  │                                                │  l    │
│ a  │    ┌─────────────────┐                         │  i    │
│ n  │    │  Aircraft Popup  │                         │  s    │
│ e  │    │  [Follow] [Hist] │                         │  t    │
│ l  │    └─────────────────┘                         │       │
│    │                                                │  P    │
│ (  │  ┌──────────────┐                              │  a    │
│ S  │  │ Measure: 125km│                              │  n    │
│ e  │  └──────────────┘                              │  e    │
│ a  │                                                │  l    │
│ r  │  ═══ Toolbar: [✏Draw] [📏Measure] [🔍Search]  │       │
│ c  │  ═══ [⬜Rect] [⭕Circle] [🔷Polygon] [❌Clear] │       │
│ h  ├────────────────────────────────────────────────┤       │
│ )  │  Status: 21.03°N, 105.85°E │ Zoom: 8 │ 342 ✈  │       │
└────┴────────────────────────────────────────────────┴───────┘
```

- **Left Panel (collapsible):** Search, Monitoring Zones, Layer Control
- **Right Panel (collapsible):** Watchlist groups
- **Bottom Toolbar:** Drawing tools, measure
- **Bottom Status Bar:** Coordinates, zoom, aircraft count
- **Map overlays:** Popups, tooltips, measure labels

---

## State Management (Zustand Stores)

```
useAircraftStore       → live aircraft data, selected aircraft
useDrawingStore        → drawn shapes, active tool, edit mode
useMonitoringStore     → geofence zones, alerts
useSearchStore         → query, mode, filters, results
useWatchlistStore      → groups, entries, visibility
useMapSettingsStore    → base layer, visible layers, viewport
```

Mỗi store độc lập, communicate qua selectors. Không cross-import stores trực tiếp.

---

## OpenLayers Layer Stack (từ dưới lên)

```
z-index   Layer                    Source
──────────────────────────────────────────
  0       Base Tile Layer          OSM / Satellite
 10       Monitoring Zone Layer    VectorSource (zones)
 20       Drawing Layer            VectorSource (user-drawn shapes)
 30       Route History Layer      VectorSource (route LineStrings)
 40       Aircraft Layer           VectorSource (aircraft points)
 50       Watchlist Highlight      VectorSource (highlighted aircraft)
 60       Search Result Highlight  VectorSource (search matches)
 70       Measure Layer            VectorSource (measure lines)
 --       Popups (OL Overlay)      DOM elements
```

---

## API Endpoints cần (Backend)

| Method | Path                                  | Mô tả                                    |
| ------ | ------------------------------------- | ---------------------------------------- |
| GET    | `/api/aircraft/search`                | Tìm kiếm aircraft (global)               |
| GET    | `/api/aircraft/{icao}/history`        | Lịch sử vị trí aircraft                  |
| POST   | `/api/aircraft/search/area`           | Tìm aircraft trong geometry + time range |
| GET    | `/api/watchlist`                      | Lấy danh sách watchlist groups           |
| POST   | `/api/watchlist`                      | Tạo watchlist group                      |
| PUT    | `/api/watchlist/{id}`                 | Cập nhật watchlist group                 |
| DELETE | `/api/watchlist/{id}`                 | Xóa watchlist group                      |
| POST   | `/api/watchlist/{id}/aircraft`        | Thêm aircraft vào group                  |
| DELETE | `/api/watchlist/{id}/aircraft/{icao}` | Xóa aircraft khỏi group                  |
| GET    | `/api/monitoring/zones`               | Lấy danh sách monitoring zones           |
| POST   | `/api/monitoring/zones`               | Tạo monitoring zone                      |
| DELETE | `/api/monitoring/zones/{id}`          | Xóa monitoring zone                      |

---

## Thứ tự triển khai đề xuất

```
Phase 0 ──→ Phase 1 ──→ Phase 2 ──→ Phase 3
  (Map)      (Aircraft)   (Drawing)   (Measure)
                │
                ├──→ Phase 5 (Search)
                │
                ├──→ Phase 6 (Watchlist)
                │      │
                │      └──→ Phase 7 (Route History)
                │
                └──→ Phase 4 (Monitoring Zones)
                              │
                              └──→ Phase 8 (Polish)
```

- **Phase 0 + 1:** Nền tảng, phải xong trước mọi thứ (~3-4 ngày)
- **Phase 2 + 3:** Drawing & Measure song song được (~2-3 ngày)
- **Phase 4, 5, 6:** Có thể song song (mỗi phase ~2-3 ngày)
- **Phase 7:** Phụ thuộc Phase 1 + 6 (~2 ngày)
- **Phase 8:** Ongoing polish

**Tổng ước tính: ~3-4 tuần** cho all features

---

## Key Technical Decisions

1. **OpenLayers thay vì Mapbox/Leaflet:** Free, no API key, mạnh về GIS features (draw, measure, projections)
2. **Zustand thay vì Redux:** Lightweight, ít boilerplate, đã có pattern trong project
3. **Feature-based folder structure:** Tách `aircraft/`, `ship/`, `drawing/`, `monitoring/`, `search/`, `watchlist/` riêng biệt
4. **OL Map instance qua React Context:** Một instance duy nhất, các layer components subscribe qua context
5. **Tách aircraft vs ship hoàn toàn:** Cùng pattern nhưng khác folder, types, styles, layers — dễ maintain
6. **Aircraft icons từ tar1090 markers.js:** 80+ SVG shape paths, port sang TypeScript. Không tự vẽ icon, dùng chuẩn cộng đồng ADS-B
7. **Icon resolution theo tar1090 getBaseMarker():** 4-level fallback: TypeDesignator → TypeDescription+WTC → Category → default
8. **Country lookup từ tar1090 ICAO_Ranges:** Không cần external API — ICAO hex chứa thông tin quốc gia enrich client-side
9. **Registration tính từ ICAO hex (tar1090 registrations.js):** US N-numbers, Japan JA, Korea HL, EU stride — offline, không cần DB. Fallback sang tar1090-db cho các nước khác
10. **tar1090-db sharded lazy-loading:** 16 shard files (0.js–F.js), load on-demand theo hex prefix. Tránh load cả DB upfront (~5MB raw)

---

## Notes cho Ship (tương lai)

Khi thêm tàu thuyền, tạo `features/ship/` với cùng cấu trúc `features/aircraft/`:

- `ShipMapLayer.tsx`, `ShipPopup.tsx`, `ShipRouteLayer.tsx`
- `useShipSocket.ts`, `useShipStore.ts`
- `shipStyle.ts` (icon tàu, xoay theo heading)
- Search, watchlist, monitoring zones tái sử dụng được — chỉ thêm entity type filter
