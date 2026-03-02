# Frontend Improvement Plan – Phase 2

## Scope

Five targeted improvements to the frontend map & watchlist UX.

---

## Task 1 – Layer Panel (Map Layer Manager)

### Goal

Add a floating panel that lets the user toggle individual map layers on/off.

### Current state

All layers are always rendered: `AircraftMapLayer`, `HistoryTrailLayer`, and (soon) a watchlist overlay.  
There is no UI to control visibility.

### Layers to manage in v1

| ID          | Label              | Default |
| ----------- | ------------------ | ------- |
| `live`      | Live Aircraft      | on      |
| `watchlist` | Watchlist Aircraft | on      |
| `trail`     | History Trail      | on      |

### Changes

#### New file: `src/features/map/store/useLayerStore.ts`

```ts
type LayerId = "live" | "watchlist" | "trail";
interface LayerState {
  visible: Record<LayerId, boolean>;
  toggle: (id: LayerId) => void;
}
```

Zustand store. Initial state: all layers visible.

#### New file: `src/features/map/components/LayerPanel.tsx`

- Floating panel, bottom-left of map (`absolute bottom-4 left-4 z-30`)
- Toggle button (stack-of-layers icon SVG) that opens/closes the panel
- Panel lists each layer with a checkbox + colour swatch
- Reads/writes `useLayerStore`

#### Modify `AircraftFeatureLayer.tsx`

- Subscribe to `useLayerStore`
- Pass `visible` booleans down to `AircraftMapLayer` and `HistoryTrailLayer`
- Both components already accept an optional `visible` prop (add it)

#### Modify `AircraftMapLayer.tsx`

```ts
type AircraftMapLayerProps = {
  visible?: boolean;
  filter?: "all" | "watchlist";
};
```

- When `visible=false`: set OL layer `setVisible(false)`
- When `filter="watchlist"`: only render ICAOs in `useWatchlistStore.getVisibleIcaos()`

#### Mount `LayerPanel` in `App.tsx` inside `<MapContainer>` alongside other overlays.

### Tests

- Unit: `useLayerStore` – toggle changes visibility
- Component: `LayerPanel` renders checkboxes, clicking toggles store

---

## Task 2 – Layer Filter: All vs Watchlist Aircraft

### Goal

From the Layer Panel, user can choose to show **all aircraft** or **only watchlist aircraft** on the `live` layer.

### How it fits with Task 1

`useLayerStore` gains a second field:

```ts
interface LayerState {
  visible: Record<LayerId, boolean>;
  aircraftFilter: "all" | "watchlist"; // NEW
  toggle: (id: LayerId) => void;
  setAircraftFilter: (f: "all" | "watchlist") => void; // NEW
}
```

### Layer Panel UI addition

Radio/segmented control inside the "Live Aircraft" row:

```
● All aircraft    ○ Watchlist only
```

### AircraftMapLayer filtering logic

```ts
const visibleIcaos = useWatchlistStore((s) => s.getVisibleIcaos());

// in render loop:
const shouldRender = (icao: string) =>
  aircraftFilter === "all" || visibleIcaos.has(icao.toLowerCase());
```

### Performance note

`getVisibleIcaos()` already returns a `Set<string>`. The OL render loop calls this per-frame via the existing style function — no extra React renders needed. If the live aircraft map has >1 000 entries, switch from `Set.has()` to a pre-computed filter at the store level (debounced 200 ms).

---

## Task 3 – Fix: Cannot Create Watchlist Group

### Diagnosis

`createGroup` in `useWatchlistStore` throws if the API call fails, but the error is **not caught by `WatchlistPanel`** — the panel never calls `createGroup` directly; `CreateGroupInline` does and it has a `try/catch`. So the bug is one of:

1. **Network / auth**: the `POST /api/v1/watchlist` call fails because the token is not sent, OR
2. **Store not hydrated**: `fetchGroups()` is never called so the groups array is empty and no auto-default exists.

### Fix steps

#### a) Ensure `fetchGroups` is called on auth

In `useWatchlistSync.ts` (or wherever hydration happens), add:

```ts
useEffect(() => {
  if (isAuthenticated) void fetchGroups();
}, [isAuthenticated]);
```

Currently check whether this hook is actually mounted — if not, mount it in `App.tsx`.

#### b) Verify `httpRequest` sends the Authorization header

Open `src/shared/api/httpClient.ts`. If the token is read from `localStorage` / `useAuthStore` only in React hooks, the isolated `httpRequest` function may not have it.  
Pattern to verify:

```ts
// httpClient.ts must read the token at call time, not at import time:
const token = useAuthStore.getState().accessToken; // ✅ getState() works outside React
```

#### c) Surface the API error in `WatchlistPanel`

`CreateGroupInline` already shows `error` state — confirm it is visible (not clipped by overflow).

#### d) Add a visual "loading" indicator on the create button (already in `CreateGroupInline` via `submitting` state — just ensure it's not broken).

---

## Task 4 – Popup UX cleanup

### 4a – Show country flag image instead of emoji

Currently: `countryFlag()` returns a Unicode flag emoji (◁ works on most OS but renders differently).

Replace with:

```tsx
// Use flagcdn.com 20px flag image (already stored in aircraft.countryFlagUrl)
{
  aircraft.countryFlagUrl ? (
    <img
      src={aircraft.countryFlagUrl}
      alt={aircraft.countryCode ?? ""}
      className="h-4 w-6 rounded-sm object-cover"
    />
  ) : (
    <span className="text-base">🌐</span>
  );
}
```

`aircraft.countryFlagUrl` is already populated by `toAircraft()` in `aircraftTypes.ts`.  
Remove the `countryFlag()` emoji function — it becomes unused.

Also show the flag inline next to the country code in the detail rows:

```
Country  🇻🇳 VN
```

→

```
Country  [flag img] VN
```

### 4b – Simplify Flight Trail hour input

Remove the 5 preset buttons (`1h 3h 6h 12h 24h`). Keep only:

- `<input type="number" min=1 max=168>` with placeholder "hours"
- `Show Trail (Xh)` / `Clear Trail (N pts)` button

**Files changed**: `AircraftPopup.tsx` – remove `TRAIL_PRESETS`, remove the preset button row + the `customHours === String(h)` comparison.

**Tests**: update `AircraftPopup.test.tsx` – preset button assertions removed, number input used directly.

---

## Task 5 – Add to Watchlist: auto default group + multi-group

### 5a – Create a "Default" group automatically on first use

When user clicks "Add to Watchlist" and there are **no groups**, instead of showing "No groups yet", do:

1. Call `createGroup("Default", "#3b82f6")` silently
2. Immediately add the aircraft to that new group
3. Show a toast/inline message: _"Added to Default group"_

This removes friction — user does not need to manually create a group.

**Changes in `AddToWatchlistDropdown.tsx`**:

```ts
async function handleAddToDefault() {
  setAdding(-1); // special sentinel
  try {
    await createGroup("Default", "#3b82f6");
    const freshGroups = useWatchlistStore.getState().groups;
    const defaultGroup = freshGroups[freshGroups.length - 1];
    await addAircraft(defaultGroup.id, icao.toLowerCase());
    setDone(-1);
  } finally {
    setAdding(null);
  }
}
```

Empty state UI becomes:

```tsx
<button onClick={() => void handleAddToDefault()}>Add to Default group</button>
```

### 5b – Allow one aircraft in multiple groups

This is already supported by the data model: `WatchlistEntry` is per `(groupId, icao)` pair.  
The only change needed is **UX**: the dropdown already allows adding to each group independently — the `alreadyIn` check prevents double-add per group, which is correct.

Clarification on current UX flow (no code change needed):

- User can add `icao` to Group A → tick appears on Group A
- User can also add same `icao` to Group B → tick on Group B
- Both groups show the aircraft ✓

### 5c – Post-add: allow moving aircraft between groups

Add a "Move to…" action inside `WatchlistAircraftRow.tsx`:

- Small "⇒" icon button that opens an inline dropdown of other groups
- On select: call `removeAircraft(currentGroupId, icao)` then `addAircraft(targetGroupId, icao)`

This is **optional scope** for this phase — deprioritise if time is limited.

---

## Implementation Order

| Priority | Task                                          | Effort | Risk                    |
| -------- | --------------------------------------------- | ------ | ----------------------- |
| P0       | **Task 3** – Fix watchlist create bug         | S      | Low                     |
| P0       | **Task 4b** – Remove trail presets (simplify) | XS     | Low                     |
| P1       | **Task 4a** – Show flag image in popup        | XS     | Low                     |
| P1       | **Task 5a** – Auto default group              | S      | Low                     |
| P2       | **Task 1** – Layer Panel UI                   | M      | Medium                  |
| P2       | **Task 2** – All vs Watchlist filter          | S      | Low (depends on Task 1) |
| P3       | **Task 5c** – Move aircraft between groups    | M      | Low                     |

---

## Files to Create / Modify

### New files

- `src/features/map/store/useLayerStore.ts`
- `src/features/map/store/useLayerStore.test.ts`
- `src/features/map/components/LayerPanel.tsx`
- `src/features/map/components/LayerPanel.test.tsx`

### Modified files

- `src/features/aircraft/components/AircraftPopup.tsx` — flag image, remove trail presets
- `src/features/aircraft/components/AircraftPopup.test.tsx` — update tests
- `src/features/aircraft/components/AircraftMapLayer.tsx` — accept `visible` + `filter` props
- `src/features/aircraft/components/AircraftFeatureLayer.tsx` — connect layer store
- `src/features/watchlist/components/AddToWatchlistDropdown.tsx` — auto default group
- `src/features/watchlist/hooks/useWatchlistSync.ts` — ensure `fetchGroups` is called
- `src/shared/api/httpClient.ts` — verify token forwarding (read-only audit)
- `src/App.tsx` — mount `LayerPanel`
