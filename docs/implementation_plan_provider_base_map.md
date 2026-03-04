# Map Tile Provider System - Implementation Plan

## Goal
Replace hardcoded base map logic with a provider-based system that is:
- extensible (add provider without touching core map code)
- safe (fallback when config/provider is invalid)
- backward compatible with existing `baseLayerType` flow

## Current State
- `frontend-ui/src/features/map/layers/baseLayer.ts` hardcodes OSM + Satellite.
- `frontend-ui/src/features/map/components/MapToolbar.tsx` hardcodes 2 buttons.
- `frontend-ui/src/features/map/hooks/useOlMap.ts` depends on `BaseLayerType`.
- `frontend-ui/src/features/map/components/MapContainer.tsx` holds local base-map state.

## Scope (Phase 1)
Only support stable provider types first:
- `osm`
- `xyz`

Defer `tms/wms/wmts/mvt` to a later phase to reduce risk.

## Non-Goals (Phase 1)
- no server-side provider management
- no custom HTTP headers for tile requests (browser tile loading limitations)
- no provider auth flow in this phase

## Architecture

### 1) Provider Contract
Create `src/features/map/providers/types.ts`.

```ts
export type TileSourceType = "osm" | "xyz";
export type ProviderCategory = "online" | "offline" | "custom";

export interface MapTileProvider {
  id: string;
  name: string;
  category: ProviderCategory;
  sourceType: TileSourceType;
  url?: string; // required for xyz
  attribution?: string;
  minZoom?: number;
  maxZoom?: number;
  crossOrigin?: string;
  isDefault?: boolean;
}
```

### 2) Registry
Create `src/features/map/providers/registry.ts`.

Rules:
- provider id must be unique
- unknown id -> fallback default provider
- no provider registered -> fallback hardcoded OSM provider

API:
- `register`
- `unregister`
- `get`
- `getOrDefault`
- `getDefault`
- `list`

### 3) Layer Factory
Create `src/features/map/providers/createTileLayer.ts`.

Behavior:
- `osm` -> OpenLayers OSM source
- `xyz` -> OpenLayers XYZ source
- invalid provider config -> throw typed error, caller falls back to default provider

### 4) Built-in Providers
Create `src/features/map/providers/builtinProviders.ts`.

Built-in set:
- `osm` (default)
- `esri-satellite`
- `esri-topo`
- `cartodb-dark`
- `cartodb-light`

Init requirement:
- must be imported exactly once at app bootstrap (`main.tsx` or equivalent init file)

### 5) Backward Compatibility Layer
Update `src/features/map/layers/baseLayer.ts`:
- keep existing exports and legacy `BaseLayerType`
- internally map:
  - `osm` -> `osm`
  - `satellite` -> `esri-satellite`
- delegate to registry + factory

### 6) State Management
Create `src/features/map/providers/useBaseLayerStore.ts` (Zustand):
- `activeProviderId`
- `setProvider(id)`

Rules:
- if set unknown id -> set default id
- initial state from registry default or env override

### 7) Hook Integration
Update `src/features/map/hooks/useOlMap.ts`:
- accept `activeProviderId?: string`
- keep `baseLayerType?: BaseLayerType` for compatibility
- replace only base layer when provider changes
- do not recreate map instance
- preserve overlays and vector layers

### 8) UI Integration
Update `src/features/map/components/MapContainer.tsx`:
- consume `useBaseLayerStore` instead of local base-layer state

Update `src/features/map/components/MapToolbar.tsx`:
- render provider buttons dynamically from registry
- props migrate from `baseLayerType` to `activeProviderId`

### 9) External Config
Create `src/features/map/providers/providerConfig.ts`:
- `VITE_MAP_DEFAULT_PROVIDER`
- `VITE_MAP_PROVIDERS` (JSON array)

Behavior:
- parse failure -> warn + ignore external config
- duplicate id -> external config overwrites builtin (explicit precedence)
- invalid default id -> fallback to registry default

Optional JSON file (later if needed):
- `/public/config/map-providers.json`

## Acceptance Criteria
- User can switch between all registered providers from toolbar.
- Invalid provider id never crashes UI; always falls back to default.
- Existing map tests continue to pass.
- Switching provider does not remove existing ship/aircraft overlays.
- App still works if external provider config is missing or malformed.

## Risks and Mitigations
- Risk: registry not initialized before toolbar render.
  - Mitigation: explicit bootstrap import and startup assertion log.
- Risk: malformed env JSON.
  - Mitigation: strict parser with warning and safe fallback.
- Risk: performance regression when switching layers.
  - Mitigation: replace only base layer, keep map instance alive.

## Rollout Strategy
1. Merge core registry/factory with compatibility wrapper first.
2. Enable dynamic toolbar after tests pass.
3. Enable external config last (feature-flag style by env presence).

## Verification

### Automated
```bash
cd frontend-ui
npx vitest run
npx vitest run src/features/map/providers
```

### Manual
1. Open app and verify default provider renders.
2. Switch OSM -> Satellite -> CartoDB and verify visible tile change.
3. Trigger provider id not found (via devtools/store) and verify fallback.
4. Set malformed `VITE_MAP_PROVIDERS` and verify app still starts.

## Deliverables
- provider type + registry + factory modules
- built-in provider bootstrap
- map hook/container/toolbar integration
- external config loader
- new tests + updated old tests
