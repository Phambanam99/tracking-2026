# Plan: Aircraft Map UX Overhaul

Three interconnected issues affecting aircraft interaction on the live map.
All changes are frontend-only (backend history API already exists).

---

# Issue 1 — Popup bị header che → chuyển sang fixed panel góc trái + dashed connector

## Root cause

`AircraftPopup.tsx` dùng `ol/Overlay` định vị popup tại tọa độ (`fromLonLat([lon, lat])`) với `positioning: "bottom-center"`. Khi aircraft ở gần đỉnh map → popup bị `MapToolbar` (z-index cao hơn) che mất.

## Solution

Bỏ OL Overlay, render popup như **absolute-positioned panel** ở góc trên-trái map viewport, kết nối đến aircraft bằng **SVG dashed line** tự cập nhật realtime.

### Step 1.1 — Mở rộng `MapContext` để expose container element

File: `frontend-ui/src/features/map/context/MapContext.tsx`

```ts
export type MapContextValue = {
  map: OlMap | null;
  mapContainerEl: HTMLDivElement | null;  // ← NEW
};

export const MapContext = createContext<MapContextValue>({
  map: null,
  mapContainerEl: null,
});
```

### Step 1.2 — Pass `containerRef.current` vào context

File: `frontend-ui/src/features/map/components/MapContainer.tsx`

```tsx
<MapContext.Provider value={{ map, mapContainerEl: containerRef.current }}>
```

### Step 1.3 — Rewrite `AircraftPopup` thành fixed panel + SVG connector

File: `frontend-ui/src/features/aircraft/components/AircraftPopup.tsx`

**Bỏ hoàn toàn:**
- `import Overlay from "ol/Overlay"`
- `overlayRef`, `new Overlay(...)`, `map.addOverlay/removeOverlay`
- `overlay.setPosition(fromLonLat(...))`

**Thay bằng:**
1. Popup `<div>` với `position: absolute; top: 48px; left: 12px; z-index: 20; max-height: calc(100% - 60px); overflow-y: auto`
2. SVG overlay `<svg>` với `position: absolute; inset: 0; pointer-events: none; z-index: 19`
3. Trong SVG: `<line>` dashed từ popup anchor point → aircraft pixel position

**Popup anchor point:** bottom-right corner của popup card (popup ref → `getBoundingClientRect()` relative to map container).

### Step 1.4 — Live pixel tracking cho connector line

Dùng 2 triggers để cập nhật toạ độ pixel aircraft:

1. **`map.on('postrender', updateLine)`** — khi user pan/zoom, OL re-render → recalculate pixel
2. **Subscribe `aircraft[selectedIcao]`** từ store — khi aircraft di chuyển (lon/lat thay đổi) → `map.getPixelFromCoordinate(fromLonLat([lon, lat]))` → cập nhật `<line x2={px} y2={py} />`

Khi `selectedIcao === null` → ẩn cả popup lẫn SVG.

**Connector line style:**
```
stroke: #38bdf8 (cyan-400)
stroke-dasharray: "6 4"
stroke-width: 1.5
opacity: 0.7
```

### Step 1.5 — Cleanup: remove OL Overlay imports

Remove unused `ol/Overlay` import, `overlayRef`, and related useEffect cleanup.

---

# Issue 2 — Flight history trail (load + live-growing)

Backend đã sẵn sàng: `GET /api/v1/aircraft/{icao}/history?from={ms}&to={ms}&limit={n}` trả về `FlightPositionDto[]`.

Trail = historical positions (load 1 lần) + live positions tự động append mỗi khi aircraft nhận STOMP update. Trail chỉ dài thêm, không bao giờ xóa điểm cũ. Toàn bộ state sống trong Zustand store — `upsertAircraftBatch` tự detect aircraft đang có trail active và append thẳng vào.

### Step 2.1 — Thêm `TrailPosition` type

File mới: `frontend-ui/src/features/aircraft/types/trailTypes.ts`

```ts
export type TrailPosition = {
  lat: number;
  lon: number;
  altitude: number | null;
  heading: number | null;
  eventTime: number;
};
```

### Step 2.2 — Mở rộng `useAircraftStore` với trail state

File: `frontend-ui/src/features/aircraft/store/useAircraftStore.ts`

**State thêm vào:**
- `trailIcao: string | null` — ICAO đang có trail active
- `trailPositions: TrailPosition[]` — mảng tích lũy (historical + live), chỉ push, không pop

**Actions thêm vào:**
- `setTrail(icao, positions)` — gọi khi historical data load xong, ghi cả `trailIcao` lẫn reset `trailPositions`
- `clearTrail()` — xóa trail, `trailIcao = null`, `trailPositions = []`

**Sửa `upsertAircraftBatch`:**
Trong `set()`, sau khi merge aircraft mới, kiểm tra: nếu bất kỳ aircraft nào trong batch có `icao === state.trailIcao` → tạo `TrailPosition` từ aircraft đó → append vào `trailPositions`.
Điểm mấu chốt: live append xảy ra tự động trong cùng một store write, zero wiring bên ngoài.

**Sửa `selectAircraft(null)`:**
Khi deselect → `clearTrail()` tự động.

### Step 2.3 — History API client

File mới: `frontend-ui/src/features/aircraft/api/aircraftHistoryApi.ts`

```ts
import { httpRequest } from "../../../shared/api/httpClient";
import type { TrailPosition } from "../types/trailTypes";

type FlightPositionDto = {
  icao: string;
  lat: number;
  lon: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  eventTime: number;
  sourceId: string | null;
};

export async function fetchFlightHistory(
  icao: string,
  fromMs: number,
  toMs: number,
  limit = 2000,
): Promise<TrailPosition[]> {
  const data = await httpRequest<FlightPositionDto[]>({
    path: `/api/v1/aircraft/${icao}/history?from=${fromMs}&to=${toMs}&limit=${limit}`,
    method: "GET",
  });
  return data.map((p) => ({
    lat: p.lat,
    lon: p.lon,
    altitude: p.altitude,
    heading: p.heading,
    eventTime: p.eventTime,
  }));
}
```

### Step 2.4 — `useFlightHistory` hook

File mới: `frontend-ui/src/features/aircraft/hooks/useFlightHistory.ts`

State: `{ isLoading, error }` (positions sống trong store).
Method `loadTrail(icao, hoursBack)`:
1. `toMs = Date.now()`, `fromMs = toMs - hoursBack * 3_600_000`
2. Gọi `fetchFlightHistory`
3. Gọi `store.setTrail(icao, positions)` → `upsertAircraftBatch` tự append live updates từ đây

```ts
import { useState, useCallback } from "react";
import { fetchFlightHistory } from "../api/aircraftHistoryApi";
import { useAircraftStore } from "../store/useAircraftStore";

export type UseFlightHistoryResult = {
  isLoading: boolean;
  error: string | null;
  loadTrail: (icao: string, hoursBack: number) => Promise<void>;
};

export function useFlightHistory(): UseFlightHistoryResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setTrail = useAircraftStore((s) => s.setTrail);

  const loadTrail = useCallback(async (icao: string, hoursBack: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const toMs = Date.now();
      const fromMs = toMs - hoursBack * 3_600_000;
      const positions = await fetchFlightHistory(icao, fromMs, toMs);
      setTrail(icao, positions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trail");
    } finally {
      setIsLoading(false);
    }
  }, [setTrail]);

  return { isLoading, error, loadTrail };
}
```

### Step 2.5 — Trail UI control trong `AircraftPopup`

File: `frontend-ui/src/features/aircraft/components/AircraftPopup.tsx`

Thêm section `TrailControls` trong `PopupContent`:

```
── Flight Trail ────────────────
[1h] [3h] [6h] [12h] [24h]    ← toggle button group
[Show Trail]  hoặc [Clear Trail (N pts)]
```

- **Show Trail** → gọi `loadTrail(icao, selectedHours)` → spinner during loading
- **Clear Trail** → `store.clearTrail()`
- Label **N pts** update realtime theo `trailPositions.length`

### Step 2.6 — `HistoryTrailLayer` OL component

File mới: `frontend-ui/src/features/aircraft/components/HistoryTrailLayer.tsx`

- Subscribe `trailIcao` và `trailPositions` từ store
- `trailIcao === null` || `trailPositions.length === 0` → `source.clear()`, return
- Khi `trailPositions` thay đổi → cập nhật geometry của existing `Feature<LineString>`:
  ```ts
  existingFeature.getGeometry().setCoordinates(
    trailPositions.map((p) => fromLonLat([p.lon, p.lat]))
  );
  ```
- Style:
  - `zIndex = 9` (dưới aircraft layer = 10)
  - Stroke `#22d3ee` (cyan-400), width 2, `lineDash: [4, 3]`
  - Circle dot ở điểm đầu tiên (oldest) và điểm cuối cùng (newest)
- Must be rendered inside `MapContext` (requires `useMapContext`)

### Step 2.7 — Mount `HistoryTrailLayer` vào `AircraftFeatureLayer`

File: `frontend-ui/src/features/aircraft/components/AircraftFeatureLayer.tsx`

```tsx
<HistoryTrailLayer />   {/* TRƯỚC AircraftMapLayer → aircraft renders on top */}
<AircraftMapLayer />
<AircraftPopup />
<AircraftDetailPanel />
<AltitudeLegend />
```

---

# Issue 3 — Aircraft đột ngột biến mất

## Root cause analysis

| # | Nguyên nhân | Chi tiết |
|---|---|---|
| A | **Stale pruning quá aggressive** | `MAX_AGE_MS = 120_000` (2 phút) trong `useAircraftSocket.ts`. Aircraft ít update (bay chậm, coverage gap) → bị xóa sớm |
| B | **Viewport bbox filter** | STOMP subscription filter theo `BoundingBox`. Pan/zoom → subscription thay đổi → window trống giữa unsub cũ + sub mới → aircraft mất update → bị prune |
| C | **Reconnect race condition** | `useFlightSocket` reconnect khi `token`/`viewport` thay đổi. Prune interval chạy đúng lúc reconnect → xóa aircraft trước khi data mới về |
| D | **Không có visual feedback** | Aircraft biến mất ngay lập tức, không fade → cảm giác "đột ngột" |

## Fixes

### Step 3.1 — Tăng `MAX_AGE_MS` về 5 phút (khớp backend TTL)

File: `frontend-ui/src/features/aircraft/hooks/useAircraftSocket.ts`

```ts
// TRƯỚC:
const MAX_AGE_MS = 120_000;    // 2 min
// SAU:
const MAX_AGE_MS = 300_000;    // 5 min — khớp LiveAircraftCacheWriter.ttl-seconds: 300
```

Lý do: backend `LiveAircraftCacheWriter` có `live-cache.ttl-seconds: 300` → Redis giữ aircraft 5 phút → frontend nên có cùng TTL.

### Step 3.2 — Viewport change grace period (pause prune khi reconnect)

File: `frontend-ui/src/features/aircraft/hooks/useAircraftSocket.ts`

Thêm `viewportChangedAtRef = useRef<number>(0)`:
- Khi `viewport` thay đổi → set `viewportChangedAtRef.current = Date.now()`
- Trong `pruneStale` interval callback: skip prune nếu `Date.now() - viewportChangedAtRef.current < 15_000`

Tránh race condition: subscription mới cần ~5-10s để nhận đủ data → prune bị pause trong 15s cho an toàn.

### Step 3.3 — Staleness visual indicator (fade trước khi prune)

File: `frontend-ui/src/features/aircraft/render/aircraftStyle.ts`

Thêm param `opacity` vào `AircraftStyleOptions`:

```ts
export type AircraftStyleOptions = {
  // ... existing fields ...
  /** Opacity 0-1. Stale aircraft get lower opacity before pruning. */
  opacity?: number;
};
```

Trong `createAircraftStyle`, apply `icon.setOpacity(opacity ?? 1.0)`.

Update cache key to include opacity bucket: `fresh` (>= 0.8), `stale` (0.4-0.79), `aging` (< 0.4).

File: `frontend-ui/src/features/aircraft/components/AircraftMapLayer.tsx`

Trong `syncFeatures`, tính staleness:
```ts
const ageMs = Date.now() - aircraft.lastSeen;
const opacity = ageMs < 60_000 ? 1.0       // fresh: < 1 min
              : ageMs < 180_000 ? 0.5      // stale: 1–3 min
              : 0.25;                       // aging: 3–5 min → rồi bị prune
```

Pass `opacity` vào `getCachedAircraftStyle(...)`.

### Step 3.4 — Refresh staleness opacity trên RAF tick

File: `frontend-ui/src/features/aircraft/components/AircraftMapLayer.tsx`

Trong RAF `tick()` function (đã tồn tại cho interpolation), thêm logic:
- Mỗi ~2 giây (throttle bằng counter), recalculate opacity cho tất cả visible features
- Nếu opacity thay đổi band (fresh → stale) → `feature.setStyle(...)` với opacity mới

Đảm bảo aircraft fade dần dần thay vì biến mất đột ngột.

---

# Data flow tổng thể

```
STOMP WebSocket
    │
    ▼
useAircraftSocket.onMessage
    │
    ▼
upsertAircraftBatch(batch)
    │
    ├──→ aircraft[icao] updated (existing)
    │
    ├──→ [if aircraft.icao === state.trailIcao]
    │       trailPositions = [...trailPositions, newTrailPos]
    │                    │
    │                    ▼
    │          HistoryTrailLayer reacts → geometry.setCoordinates(...)
    │          → OL re-renders trail line
    │
    └──→ AircraftMapLayer reacts
         → syncFeatures() with staleness opacity
         → RAF tick: interpolate positions + update connector line pixel
                                      │
                                      ▼
                             AircraftPopup SVG <line> updates x2,y2
```

---

# Verification checklist

## Issue 1 — Popup relocated
- [ ] Click aircraft → popup appears top-left of map, never behind header
- [ ] Dashed line connects popup to aircraft marker
- [ ] Pan/zoom → line endpoint follows aircraft smoothly
- [ ] Aircraft moves (live update) → line endpoint tracks in realtime
- [ ] Click another aircraft → popup + line switch instantly
- [ ] Click empty map → popup + line disappear
- [ ] Popup scrollable when content exceeds map height

## Issue 2 — Flight trail
- [ ] Load trail 1h → trail hiện với N điểm historical
- [ ] Đợi aircraft nhận update mới qua STOMP → trail dài thêm 1 điểm tự động
- [ ] Clear trail → line biến mất
- [ ] Chọn aircraft khác → trail cũ tự clear
- [ ] Pan/zoom → trail bám đúng vị trí địa lý
- [ ] Load trail 3h sau khi đã có 1h → trail reset, không stack
- [ ] Trail renders dưới aircraft icon (z-index 9 < 10)

## Issue 3 — Aircraft disappearing
- [ ] Aircraft không biến mất trong 5 phút (thay vì 2)
- [ ] Aircraft > 1 phút không update → opacity giảm ~50%
- [ ] Aircraft > 3 phút → opacity giảm ~25%, rõ ràng đang "cũ"
- [ ] Pan/zoom nhanh → aircraft không bị prune trong 15 giây grace period
- [ ] Reconnect socket → aircraft giữ nguyên trong khi chờ data mới

---

# Files thay đổi tổng hợp

| File | Thay đổi | Issue |
|---|---|---|
| `map/context/MapContext.tsx` | Thêm `mapContainerEl` vào context type | #1 |
| `map/components/MapContainer.tsx` | Pass `containerRef.current` vào context value | #1 |
| `aircraft/components/AircraftPopup.tsx` | Bỏ OL Overlay → fixed panel + SVG connector line + trail controls UI | #1, #2 |
| `aircraft/types/trailTypes.ts` | **Mới** — `TrailPosition` type | #2 |
| `aircraft/api/aircraftHistoryApi.ts` | **Mới** — `fetchFlightHistory()` | #2 |
| `aircraft/hooks/useFlightHistory.ts` | **Mới** — `useFlightHistory` hook | #2 |
| `aircraft/components/HistoryTrailLayer.tsx` | **Mới** — OL `Feature<LineString>` layer | #2 |
| `aircraft/store/useAircraftStore.ts` | Thêm `trailIcao`, `trailPositions`, `setTrail`, `clearTrail`; sửa `upsertAircraftBatch` + `selectAircraft` | #2 |
| `aircraft/components/AircraftFeatureLayer.tsx` | Mount `HistoryTrailLayer` | #2 |
| `aircraft/hooks/useAircraftSocket.ts` | `MAX_AGE_MS` 120s → 300s; viewport grace period 15s; guard prune on reconnect | #3 |
| `aircraft/render/aircraftStyle.ts` | Thêm `opacity` param vào `AircraftStyleOptions`; apply trong `createAircraftStyle` | #3 |
| `aircraft/components/AircraftMapLayer.tsx` | Tính staleness opacity trong `syncFeatures`; refresh opacity trong RAF tick | #3 |
