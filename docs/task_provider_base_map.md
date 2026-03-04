# Map Tile Provider System - Task Checklist

## 0) Prep and Alignment
- [ ] Confirm scope: Phase 1 only supports `osm` and `xyz`.
- [ ] Confirm bootstrap file for provider init (`main.tsx` or app init module).
- [ ] Confirm test command (`npx vitest run`) works locally.
- [ ] Confirm no breaking change required for legacy `BaseLayerType`.

## 1) Core Types and Registry
- [ ] Create `frontend-ui/src/features/map/providers/types.ts`.
- [ ] Create `frontend-ui/src/features/map/providers/registry.ts`.
- [ ] Implement registry rules:
  - [ ] Unique provider id enforcement.
  - [ ] `getOrDefault(id)` fallback behavior.
  - [ ] Safe default when registry is empty.
- [ ] Add tests `frontend-ui/src/features/map/providers/__tests__/registry.test.ts`.
- [ ] Validate test cases:
  - [ ] Register/get/unregister.
  - [ ] Duplicate id behavior.
  - [ ] Default fallback behavior.

## 2) Layer Factory and Built-in Providers
- [ ] Create `frontend-ui/src/features/map/providers/createTileLayer.ts`.
- [ ] Support only:
  - [ ] `osm` source
  - [ ] `xyz` source
- [ ] Add validation for required fields (`xyz.url`).
- [ ] Create `frontend-ui/src/features/map/providers/builtinProviders.ts`.
- [ ] Register built-in providers:
  - [ ] `osm` (default)
  - [ ] `esri-satellite`
  - [ ] `esri-topo`
  - [ ] `cartodb-dark`
  - [ ] `cartodb-light`
- [ ] Add tests `frontend-ui/src/features/map/providers/__tests__/createTileLayer.test.ts`.

## 3) Compatibility Wrapper
- [ ] Refactor `frontend-ui/src/features/map/layers/baseLayer.ts` to delegate to registry/factory.
- [ ] Keep legacy exports and `BaseLayerType`.
- [ ] Map legacy types:
  - [ ] `osm` -> `osm`
  - [ ] `satellite` -> `esri-satellite`
- [ ] Ensure old tests still pass:
  - [ ] `frontend-ui/src/features/map/layers/baseLayer.test.ts`
  - [ ] `frontend-ui/src/features/map/hooks/useOlMap.test.ts`

## 4) State and Hook Integration
- [ ] Create `frontend-ui/src/features/map/providers/useBaseLayerStore.ts`.
- [ ] Add store tests `frontend-ui/src/features/map/providers/__tests__/useBaseLayerStore.test.ts`.
- [ ] Refactor `frontend-ui/src/features/map/hooks/useOlMap.ts`:
  - [ ] Accept `activeProviderId?: string`.
  - [ ] Keep `baseLayerType?: BaseLayerType` for compatibility.
  - [ ] Replace only base layer when provider changes.
  - [ ] Preserve overlays/vector layers.
  - [ ] Do not recreate map instance.
- [ ] Refactor `frontend-ui/src/features/map/components/MapContainer.tsx` to use store.

## 5) Dynamic Toolbar
- [ ] Refactor `frontend-ui/src/features/map/components/MapToolbar.tsx`.
- [ ] Render provider buttons dynamically from registry.
- [ ] Update props from `baseLayerType` to `activeProviderId`.
- [ ] Add/adjust toolbar tests for dynamic rendering and selected state.

## 6) External Config Loader
- [ ] Create `frontend-ui/src/features/map/providers/providerConfig.ts`.
- [ ] Add env support:
  - [ ] `VITE_MAP_DEFAULT_PROVIDER`
  - [ ] `VITE_MAP_PROVIDERS`
- [ ] Define precedence:
  - [ ] External config overrides built-in by id.
  - [ ] Invalid provider entries are ignored with warning.
- [ ] On parse/config failure, fallback to built-in default.
- [ ] Add tests for config parsing and fallback.

## 7) Bootstrap and Wiring
- [ ] Import built-in provider registration in bootstrap entry.
- [ ] Ensure external config loader runs once during app startup.
- [ ] Verify startup does not crash when env is absent.

## 8) i18n (Optional in Phase 1)
- [ ] Add provider label keys if i18n system is active.
- [ ] Keep fallback to raw provider `name` when translation key is missing.

## 9) Verification Checklist

### Automated
- [ ] `cd frontend-ui && npx vitest run`
- [ ] `cd frontend-ui && npx vitest run src/features/map/providers`
- [ ] Confirm legacy map tests still green.

### Manual
- [ ] Default provider displays correctly on first load.
- [ ] Switching OSM <-> Satellite works.
- [ ] Switching to Carto providers works.
- [ ] Unknown provider id falls back to default without UI crash.
- [ ] Malformed `VITE_MAP_PROVIDERS` does not break app startup.
- [ ] Existing ship/aircraft overlays stay visible after base-layer switch.

## 10) Definition of Done
- [ ] All checklist items in sections 1-7 completed.
- [ ] Automated tests green.
- [ ] Manual verification complete.
- [ ] No regressions in existing map behavior.
- [ ] Plan docs updated if implementation deviates.
