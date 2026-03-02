# Frontend Improvement Plan Review

**Date:** 2026-03-02
**Reviewer:** Tech lead review
**Scope:** frontend auth persistence, aircraft realtime mapping, popup/detail UX, map rendering cost

## 1. Review Summary

The original plan is directionally correct, but it assumes a frontend payload shape that does not match the current backend contract.

Key corrections:

- `LiveFlightMessage.flight` is `EnrichedFlight`, not a flat object with metadata fields at top level.
- Backend sends `event_time` and `source_id` in snake_case.
- Aircraft metadata such as `registration`, `aircraftType`, `operator`, and `countryCode` is nested under `flight.metadata`.
- The current frontend store has no state for a detail panel, so "add a button" is not enough. A state flow is required.
- The highest-priority defect is still auth persistence on refresh. That should ship first.

## 2. Revised Priorities

### P0: Must ship

1. Persist auth tokens across refresh in `sessionStorage`
2. Fix frontend aircraft mapping to match backend WebSocket payload
3. Show position, event time, and source in popup
4. Add a detail panel flow from popup

### P1: Strongly recommended

5. Add altitude legend on top of the map
6. Add style caching so repeated icon recreation does not happen on every update
7. Batch socket upserts before writing into Zustand

### P2: Later if traffic scale requires it

8. Evaluate OpenLayers WebGL renderer for very high aircraft counts

## 3. Corrected Backend Contract

Current backend DTOs indicate the frontend should expect this shape:

```json
{
  "sent_at": 1700000000000,
  "flight": {
    "icao": "A1B2C3",
    "lat": 10.1234,
    "lon": 106.5678,
    "altitude": 35000,
    "speed": 450.0,
    "heading": 270.0,
    "event_time": 1700000000000,
    "source_id": "RADARBOX-GLOBAL",
    "is_historical": false,
    "metadata": {
      "registration": "VN-A321",
      "aircraftType": "A321",
      "operator": "Vietnam Airlines",
      "countryCode": "VN"
    }
  }
}
```

Frontend mapping should also remain tolerant of camelCase fields if any intermediate gateway serializer already transforms names.

## 4. Execution Plan

### Task 1: Fix refresh logout

**Files**

- `frontend-ui/src/features/auth/security/tokenStorage.ts`
- `frontend-ui/src/features/auth/security/tokenStorage.test.ts`

**Implementation**

- Replace memory-only token storage with `sessionStorage`
- Keep a safe in-memory fallback if `window` or storage is unavailable in tests/runtime
- Parse stored JSON defensively

**Acceptance**

- F5 in the same tab keeps the session
- `clearTokens()` removes both tokens from storage
- malformed storage content does not crash the app

### Task 2: Fix aircraft payload mapping

**Files**

- `frontend-ui/src/features/aircraft/types/aircraftTypes.ts`
- new mapper tests for aircraft payload conversion

**Implementation**

- Extend `Aircraft` with `eventTime` and `sourceId`
- Read metadata from `flight.metadata`
- Support both `event_time` and `eventTime`
- Support both `source_id` and `sourceId`

**Acceptance**

- popup receives real backend fields without manual reshaping elsewhere
- metadata still works if backend serializer returns camelCase in the future

### Task 3: Expand popup content

**Files**

- `frontend-ui/src/features/aircraft/components/AircraftPopup.tsx`
- `frontend-ui/src/features/aircraft/components/AircraftPopup.test.tsx`

**Implementation**

- Add rows for:
  - position
  - event time
  - source
- Keep current fallback behavior for missing data
- Add a "View details" action

**Acceptance**

- selected aircraft shows lat/lon
- event time is rendered if present
- source id is rendered if present

### Task 4: Add aircraft detail panel

**Files**

- `frontend-ui/src/features/aircraft/store/useAircraftStore.ts`
- `frontend-ui/src/features/aircraft/store/useAircraftStore.test.ts`
- new `frontend-ui/src/features/aircraft/components/AircraftDetailPanel.tsx`

**Implementation**

- Add detail panel state to store
- Open panel from popup
- Show full metadata and timestamps in a side panel
- Close panel explicitly and when selected aircraft disappears

**Acceptance**

- clicking "View details" opens the panel for the selected aircraft
- stale/pruned aircraft cannot leave a dangling detail view

### Task 5: Add altitude legend

**Files**

- new `frontend-ui/src/features/map/components/AltitudeLegend.tsx`
- `frontend-ui/src/features/aircraft/components/AircraftFeatureLayer.tsx`

**Implementation**

- Render a small fixed overlay inside the map container
- Reuse the same altitude color bands as the aircraft icon renderer

### Task 6: Reduce rendering cost

**Files**

- `frontend-ui/src/features/aircraft/render/aircraftStyle.ts`
- `frontend-ui/src/features/aircraft/render/aircraftStyle.test.ts`
- `frontend-ui/src/features/aircraft/components/AircraftMapLayer.tsx`
- `frontend-ui/src/features/aircraft/hooks/useAircraftSocket.ts`
- optional store tests if batching requires new actions

**Implementation**

- Cache styles by shape, altitude band, heading bucket, scale, and selection state
- Batch incoming socket messages before store writes
- Flush once per animation frame instead of per message

**Acceptance**

- repeated identical style requests reuse the same `Style`
- map layer stops rebuilding equivalent styles on every update
- high-frequency message bursts produce fewer store writes

## 5. Delivery Sequence

1. tests for token persistence
2. token storage implementation
3. tests for aircraft payload mapping
4. payload mapping implementation
5. popup tests
6. popup + detail panel implementation
7. legend implementation
8. style cache tests and implementation
9. socket batching implementation
10. frontend test run

## 6. Risks and Notes

- `sessionStorage` still exposes tokens to XSS. This is acceptable only as a short-term SPA tradeoff.
- If secure persistence is required later, move to httpOnly cookie-based auth.
- `toLocaleString()` output is locale-dependent. Tests should compare structure or use the same formatter, not hardcoded text.
- If WebSocket volume becomes very large, style caching and batched store writes will help, but they are not a substitute for WebGL-based rendering at extreme scale.
