# Frontend Improvement Plan — Phase 3

> **Scope:** Per-group watchlist filtering in Layer Panel + Military aircraft layer (backend enrichment)  
> **Status:** Planning  
> **Prerequisites:** Phase 2 Tasks 1–2 completed (Layer Panel + Watchlist overlay exist)

---

## Overview

Two new features:

1. **Per-group watchlist selection** — The Layer Panel's "Watchlist only" filter currently shows ALL watchlist aircraft. Users need to pick which specific watchlist groups are displayed.
2. **Military aircraft layer** — A dedicated map layer that highlights military aircraft. The backend enriches each flight with an `is_military` flag using the ICAO hex database (~20,396 entries); the frontend simply reads the flag.

### Architecture Decision: Backend Enrichment

| Approach                           | Bundle Size             | Single Source of Truth                 | Extensibility                                  | Deploy Speed |
| ---------------------------------- | ----------------------- | -------------------------------------- | ---------------------------------------------- | ------------ |
| Frontend-only (hex Set in browser) | +184KB raw (~40KB gzip) | No — file duplicated                   | Hard to add branch/operator                    | Fast         |
| **Backend enrichment (chosen)**    | **0**                   | **Yes** — `service-processing` owns it | Easy to add `militaryBranch`, `operator` later | Medium       |

**Decision:** Backend enrichment via `FlightEnricher`. The `military-hex-db.js` already lives in `service-processing/src/main/resources/db/` and is unused — this approach puts it to work where it belongs.

**Data flow:**

```
service-processing receives CanonicalFlight from Kafka "raw-adsb"
  → FlightEnricher.enrich()
    → MilitaryHexResolver.isMilitary(icao) lookups against in-memory Set<String>
    → sets AircraftMetadata.isMilitary = true/false
  → publishes EnrichedFlight to Kafka "live-adsb"
  → service-broadcaster pushes via WebSocket
  → frontend reads aircraft.isMilitary, renders military layer
```

---

## Task 1: Per-Group Watchlist Selection in Layer Panel

### Current State

- `WatchlistGroup.visibleOnMap: boolean` exists in the data model (client-side toggle).
- `useWatchlistStore.toggleGroupVisibility(groupId)` already flips the flag.
- `AircraftMapLayer.tsx` already **skips groups with `!group.visibleOnMap`** when building the watchlist ICAOs set.
- Layer Panel shows "All aircraft" / "Watchlist only" radio, but no per-group selection.

### What's Needed

The Layer Panel needs a sub-section under the "Watchlist Overlay" layer row showing each group with a checkbox.

### Implementation Steps

#### 1.1 — LayerPanel.tsx: Add group checkboxes

Under the **Watchlist Overlay** layer card (`layer.id === "watchlist"`), render a group list:

```tsx
{
  layer.id === "watchlist" && visible.watchlist && <WatchlistGroupFilter />;
}
```

Create a new component `WatchlistGroupFilter` (inline or separate file):

```tsx
function WatchlistGroupFilter(): JSX.Element {
  const groups = useWatchlistStore((s) => s.groups);
  const toggleGroupVisibility = useWatchlistStore(
    (s) => s.toggleGroupVisibility,
  );

  if (groups.length === 0) {
    return (
      <p className="mt-2 text-xs text-slate-500 italic">
        No watchlist groups yet
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-1 border-t border-slate-800 pt-2">
      {groups.map((group) => (
        <label
          key={group.id}
          className="flex items-center gap-2 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={group.visibleOnMap}
            onChange={() => toggleGroupVisibility(group.id)}
            className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
          />
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: group.color }}
          />
          <span className="text-xs text-slate-300">{group.name}</span>
          <span className="ml-auto text-[10px] text-slate-500">
            {group.entryCount ?? group.entries?.length ?? 0}
          </span>
        </label>
      ))}
    </div>
  );
}
```

#### 1.2 — Also show group checkboxes under Live layer when filter = "watchlist"

When the user selects "Watchlist only" under the Live Aircraft layer, they also need per-group control there. Reuse the same `WatchlistGroupFilter` component:

```tsx
{
  layer.id === "live" && aircraftFilter === "watchlist" && (
    <WatchlistGroupFilter />
  );
}
```

#### 1.3 — No store changes needed

`useWatchlistStore.toggleGroupVisibility()` and `AircraftMapLayer`'s group filtering already work correctly. The only change is **UI exposure** in the Layer Panel.

### Files Modified

| File             | Change                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------- |
| `LayerPanel.tsx` | Add `WatchlistGroupFilter` component + render it under watchlist and live-when-filtered |

### Tests

- Verify group checkboxes render when groups exist.
- Verify toggling checkbox calls `toggleGroupVisibility`.
- Verify "No groups" message when empty.

---

## Task 2: Military Aircraft Layer (Backend Enrichment)

### Current State

**Backend:**

- `military-hex-db.js` in `service-processing/src/main/resources/db/` — exports `MILITARY_HEX_LIST`, a flat JS array of ~20,396 lowercase 6-char hex strings. **Currently unused by any Kotlin code.**
- `FlightEnricher.enrich()` already enriches flights with `AircraftMetadata` (registration, type, operator, country, flag, image).
- `AircraftMetadata` in `common-dto` has **no** `isMilitary` field yet.
- The null-metadata guard in `FlightEnricher` collapses all-null metadata to `null`.

**Frontend:**

- `WireAircraftMetadata` maps backend snake_case fields to `Aircraft` type via `toAircraft()`.
- `Aircraft` has **no** `isMilitary` field yet.
- `markers.ts` and `typeDesignatorIcons.ts` already have military icon categories.

### Implementation Steps

#### 2.1 — Create `MilitaryHexResolver` (Backend)

**New file:** `service-processing/src/main/kotlin/com/tracking/processing/enrich/MilitaryHexResolver.kt`

Loads the hex DB at startup into a `Set<String>` and provides a lookup function:

```kotlin
package com.tracking.processing.enrich

/**
 * In-memory lookup of ICAO hex addresses known to belong to military aircraft.
 * Source: military-hex-db.js (~20,396 entries).
 */
public class MilitaryHexResolver {

    private val militaryHexSet: Set<String> = loadMilitaryHexSet()

    public fun isMilitary(icao: String): Boolean =
        militaryHexSet.contains(icao.lowercase())

    private companion object {
        /** Regex to extract 6-char hex strings from the JS array file. */
        private val HEX_PATTERN = Regex(""""([0-9a-f]{6})"""")

        fun loadMilitaryHexSet(): Set<String> {
            val resource = MilitaryHexResolver::class.java
                .getResourceAsStream("/db/military-hex-db.js")
                ?: error("military-hex-db.js not found on classpath")

            val content = resource.bufferedReader().use { it.readText() }
            return HEX_PATTERN.findAll(content)
                .map { it.groupValues[1] }
                .toSet()
        }
    }
}
```

**Key decisions:**

- Parse the existing `.js` file with regex rather than maintaining a second file format.
- Loaded once at construction → O(1) lookup (`HashSet`).
- Logs count at startup for observability.

#### 2.2 — Add `isMilitary` to `AircraftMetadata` (Backend — common-dto)

**File:** `common-dto/src/main/kotlin/com/tracking/common/dto/AircraftMetadata.kt`

Add a new field at the end:

```kotlin
@Serializable
public data class AircraftMetadata(
    val registration: String? = null,
    // ... existing fields ...
    @param:JsonProperty("image_url")
    @get:JsonProperty("image_url")
    @param:JsonAlias("imageUrl")
    @SerialName("image_url")
    val imageUrl: String? = null,
    @param:JsonProperty("is_military")
    @get:JsonProperty("is_military")
    @param:JsonAlias("isMilitary")
    @SerialName("is_military")
    val isMilitary: Boolean = false,
)
```

**Note:** `isMilitary` is `Boolean = false` (non-nullable with default), not `Boolean?`. This means:

- If the backend doesn't set it → `false` (safe default).
- Wire format: `"is_military": true` or absent (Jackson skips defaults).
- No impact on the null-metadata guard in `FlightEnricher` (only nullable fields are checked).

#### 2.3 — Wire `MilitaryHexResolver` into `FlightEnricher` (Backend)

**File:** `service-processing/src/main/kotlin/com/tracking/processing/enrich/FlightEnricher.kt`

Add `MilitaryHexResolver` as a constructor parameter and use it in `enrich()`:

```kotlin
public class FlightEnricher(
    private val referenceDataCache: ReferenceDataCache,
    private val icaoCountryResolver: IcaoCountryResolver,
    private val aircraftPhotoProvider: AircraftPhotoProvider = NoopAircraftPhotoProvider,
    private val icaoRegistrationResolver: IcaoRegistrationResolver = IcaoRegistrationResolver(),
    private val militaryHexResolver: MilitaryHexResolver = MilitaryHexResolver(),
) {
    public fun enrich(flight: CanonicalFlight, isHistorical: Boolean): EnrichedFlight {
        // ... existing enrichment logic ...
        val metadata = AircraftMetadata(
            registration = ...,
            aircraftType = ...,
            operator = ...,
            countryCode = ...,
            countryFlagUrl = ...,
            imageUrl = ...,
            isMilitary = militaryHexResolver.isMilitary(flight.icao),
        )
        // ... rest of the method (null-guard, return) ...
    }
}
```

**Note on null-guard:** Since `isMilitary` is non-nullable (`Boolean = false`), the existing null-metadata guard (which checks all-null fields) works correctly:

- If all other fields are null BUT `isMilitary = true` → metadata is **not** collapsed to null (correct!).
- If all other fields are null AND `isMilitary = false` → metadata becomes null (correct — nothing useful to send).

We need to update the guard to also check `isMilitary`:

```kotlin
val normalizedMetadata =
    if (
        metadata.registration == null &&
        metadata.aircraftType == null &&
        metadata.operator == null &&
        metadata.countryCode == null &&
        metadata.countryFlagUrl == null &&
        metadata.imageUrl == null &&
        !metadata.isMilitary   // <-- NEW: keep metadata if military
    ) {
        null
    } else {
        metadata
    }
```

#### 2.4 — Wire `MilitaryHexResolver` in Spring config (Backend)

Wherever `FlightEnricher` is instantiated (likely in a `@Configuration` or `@Bean` method in `ProcessingConsumerConfig`), pass the new resolver:

```kotlin
@Bean
fun militaryHexResolver(): MilitaryHexResolver = MilitaryHexResolver()

@Bean
fun flightEnricher(
    referenceDataCache: ReferenceDataCache,
    icaoCountryResolver: IcaoCountryResolver,
    // ...
    militaryHexResolver: MilitaryHexResolver,
): FlightEnricher = FlightEnricher(
    referenceDataCache = referenceDataCache,
    icaoCountryResolver = icaoCountryResolver,
    // ...
    militaryHexResolver = militaryHexResolver,
)
```

#### 2.5 — Add `is_military` to frontend wire types

**File:** `frontend-ui/src/features/aircraft/types/aircraftTypes.ts`

Add to `WireAircraftMetadata`:

```typescript
export type WireAircraftMetadata = {
  // ... existing fields ...
  image_url?: string | null;
  is_military?: boolean;
};
```

Add to `Aircraft`:

```typescript
export type Aircraft = {
  // ... existing fields ...
  lastSeen: number;
  /** Whether this aircraft belongs to a known military ICAO hex address */
  isMilitary: boolean;
};
```

Update `toAircraft()`:

```typescript
export function toAircraft(flight: AircraftFlight): Aircraft {
  const meta = flight.metadata;
  // ... existing mapping ...
  return {
    // ... existing fields ...
    lastSeen: Date.now(),
    isMilitary: meta?.is_military ?? false,
  };
}
```

#### 2.6 — Extend Layer Store

**File:** `frontend-ui/src/features/map/store/useLayerStore.ts`

```typescript
export type LayerId = "live" | "watchlist" | "trail" | "military";

// AircraftFilter stays unchanged — no "military" filter needed here
// because the military layer is a separate overlay, not a filter mode.

// Add to initial visible state:
visible: {
  live: true,
  watchlist: true,
  trail: true,
  military: false,  // Off by default
},
```

**Note:** Unlike the original plan, `AircraftFilter` does NOT need a `"military"` value. The military layer is a separate **overlay** (like the watchlist overlay), not a filter mode on the live layer. Users toggle it independently.

#### 2.7 — Extend AircraftMapLayer

**File:** `frontend-ui/src/features/aircraft/components/AircraftMapLayer.tsx`

Add military filter type and variant:

```typescript
export type AircraftLayerFilter = "all" | "watchlist" | "military";

type AircraftMapLayerProps = {
  visible?: boolean;
  filter?: AircraftLayerFilter;
  variant?: "live" | "watchlist" | "military";
  interactive?: boolean;
};
```

Update `shouldRenderAircraft` — now uses `aircraft.isMilitary` instead of a hex lookup:

```typescript
function shouldRenderAircraft(
  aircraft: Aircraft,
  filter: AircraftLayerFilter,
  watchlistIcaos: Set<string>,
): boolean {
  if (filter === "all") return true;
  if (filter === "watchlist")
    return watchlistIcaos.has(aircraft.icao.toLowerCase());
  if (filter === "military") return aircraft.isMilitary;
  return true;
}
```

Add military styling constants:

```typescript
const MILITARY_LAYER_Z_INDEX = 12;
const MILITARY_FILL_COLOR = "#ef4444"; // Red-500
const MILITARY_STROKE_COLOR = "#fbbf24"; // Amber-400
```

Update `buildFeature` and `syncFeatures` to handle `variant === "military"`:

- Scale: `scale * 1.1` (slightly larger than default).
- Fill: `MILITARY_FILL_COLOR`.
- Stroke: `MILITARY_STROKE_COLOR`.
- Opacity: always high (0.9 minimum), so military aircraft stay highly visible.
- zIndex: 12 (above watchlist overlay).

#### 2.8 — Add military layer instance to AircraftFeatureLayer

**File:** `frontend-ui/src/features/aircraft/components/AircraftFeatureLayer.tsx`

```tsx
<AircraftMapLayer
  filter="military"
  interactive={false}
  variant="military"
  visible={layerVisibility.military}
/>
```

#### 2.9 — Add military layer to LayerPanel

**File:** `frontend-ui/src/features/map/components/LayerPanel.tsx`

Add to the `LAYERS` array:

```typescript
const LAYERS: Array<{ id: LayerId; label: string; swatchClassName: string }> = [
  { id: "live", label: "Live Aircraft", swatchClassName: "bg-emerald-400" },
  {
    id: "watchlist",
    label: "Watchlist Overlay",
    swatchClassName: "bg-sky-400",
  },
  { id: "military", label: "Military Aircraft", swatchClassName: "bg-red-500" },
  { id: "trail", label: "History Trail", swatchClassName: "bg-cyan-300" },
];
```

### Files Modified / Created

#### Backend

| File                                                                       | Change                                                                           |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `common-dto/.../AircraftMetadata.kt`                                       | Add `isMilitary: Boolean = false` with Jackson/KotlinX annotations               |
| `service-processing/.../enrich/MilitaryHexResolver.kt`                     | **NEW** — In-memory hex Set loaded from `military-hex-db.js`                     |
| `service-processing/.../enrich/FlightEnricher.kt`                          | Add `MilitaryHexResolver` param; set `isMilitary` in metadata; update null-guard |
| `service-processing/.../kafka/ProcessingConsumerConfig.kt` (or equivalent) | Wire `MilitaryHexResolver` bean                                                  |

#### Frontend

| File                       | Change                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `aircraftTypes.ts`         | Add `is_military` to `WireAircraftMetadata`, `isMilitary` to `Aircraft`, update `toAircraft()` |
| `useLayerStore.ts`         | Add `"military"` to `LayerId`; add `military: false` to visible                                |
| `AircraftMapLayer.tsx`     | Handle `"military"` filter/variant; use `aircraft.isMilitary` flag                             |
| `AircraftFeatureLayer.tsx` | Add third `AircraftMapLayer` instance for military                                             |
| `LayerPanel.tsx`           | Add military row to LAYERS array                                                               |

### Tests

#### Backend

- `MilitaryHexResolverTest.kt`: Verify `isMilitary("ae292b")` → true; `isMilitary("abcdef")` → false; verify loaded count ≈ 20,396.
- `FlightEnricherTest.kt`: Add test case — flight with military ICAO → `metadata.isMilitary == true`; non-military ICAO → `false`.
- Verify JSON serialization: `"is_military": true` in output.

#### Frontend

- `useLayerStore.test.ts`: Verify military layer toggle.
- `AircraftMapLayer.test.tsx`: Verify `shouldRenderAircraft` with `isMilitary` flag.
- `LayerPanel.test.tsx`: Verify military checkbox renders.
- `aircraftTypes.test.ts`: Verify `toAircraft()` maps `is_military: true` → `isMilitary: true`.

---

## Implementation Order

| Step | Task                                                     | Module               | Estimated Effort |
| ---- | -------------------------------------------------------- | -------------------- | ---------------- |
| 1    | Task 2.1: Create `MilitaryHexResolver`                   | Backend              | Small            |
| 2    | Task 2.2: Add `isMilitary` to `AircraftMetadata`         | Backend (common-dto) | Small            |
| 3    | Task 2.3–2.4: Wire into `FlightEnricher` + Spring config | Backend              | Small            |
| 4    | Backend tests (resolver + enricher)                      | Backend              | Small            |
| 5    | Task 2.5: Frontend wire types + `toAircraft()`           | Frontend             | Small            |
| 6    | Task 2.6: Extend `useLayerStore`                         | Frontend             | Small            |
| 7    | Task 2.7: Extend `AircraftMapLayer`                      | Frontend             | Medium           |
| 8    | Task 2.8: Add military to `AircraftFeatureLayer`         | Frontend             | Small            |
| 9    | Task 1.1–1.3: Per-group selection in `LayerPanel`        | Frontend             | Medium           |
| 10   | Task 2.9: Military row in `LayerPanel`                   | Frontend             | Small            |
| 11   | Frontend tests                                           | Frontend             | Medium           |

**Total estimated effort:** ~3–4 hours (backend ~1h, frontend ~2–3h)

---

## Risks & Decisions

| Topic                                                 | Decision                                | Rationale                                                                                                 |
| ----------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Military detection approach                           | Backend enrichment via `FlightEnricher` | Single source of truth; no bundle bloat; extensible for branch/operator                                   |
| `isMilitary` field type                               | `Boolean = false` (non-nullable)        | Safe default; no wire overhead when false (Jackson skips defaults)                                        |
| Hex DB parsing                                        | Regex on existing `.js` file            | No duplicate file to maintain; source file already in `resources/db/`                                     |
| Military layer default state                          | Off by default                          | Avoid visual noise; users who want it can toggle on                                                       |
| Per-group filter affects both Live + Watchlist layers | Yes, shared `group.visibleOnMap`        | Single source of truth; toggling a group hides its aircraft everywhere                                    |
| Military styling                                      | Red fill + amber stroke                 | High contrast for military identification, distinctive from watchlist (blue) and default (altitude-based) |
| Interactive clicks on military layer                  | Disabled (`interactive={false}`)        | Military overlay is informational; clicks should still go to the live layer                               |
| `AircraftFilter` type                                 | Unchanged (`"all" \| "watchlist"`)      | Military is a separate overlay layer, not a filter mode on Live                                           |

---

## Future Extensions

Once `isMilitary` is in the pipeline, these become straightforward follow-ups:

| Feature                                  | Effort | Approach                                                                 |
| ---------------------------------------- | ------ | ------------------------------------------------------------------------ |
| `militaryBranch` (Air Force, Navy, etc.) | Medium | Extend hex DB to include branch mapping; add field to `AircraftMetadata` |
| Military operator name                   | Small  | Cross-reference with `aircraft.csv` operator column                      |
| Military layer in AircraftPopup          | Small  | Show "🎖 Military" badge when `aircraft.isMilitary`                      |
| Military-only history trail              | Small  | Add filter option in trail layer                                         |
| Persist military flag to storage         | Small  | Already in `EnrichedFlight` → `service-storage` saves it automatically   |
