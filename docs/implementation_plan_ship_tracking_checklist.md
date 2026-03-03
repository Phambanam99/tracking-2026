# Ship Tracking Implementation Checklist

## Phase 0 - Design Lock

- Chot 1 source ship dau tien va xac minh licensing/rate limit.
- Chot field list cua `CanonicalShip`.
- Chot topic names `raw-ais` va `live-ais`.
- Chot MVP acceptance criteria.
- Chot feature flag rollout strategy cho backend va frontend.

## Phase 1 - Live MVP

### `common-dto`
- Tao `CanonicalShip`.
- Tao `EnrichedShip`.
- Tao `ShipMetadata`.
- Tao `LiveShipMessage`.
- Them serialization tests cho ship DTOs.

### `service-ingestion`
- Tao ship ingest request model.
- Tao ship request validator.
- Tao `RawAisProducer`.
- Them endpoint `/api/v1/ingest/ais`.
- Them endpoint `/api/v1/ingest/ais/batch`.
- Them test cho single/batch validation va keying.

### `service-processing`
- Tao `RawAisConsumer`.
- Tao `ShipStateFusionEngine`.
- Tao `ShipKinematicValidator`.
- Tao `ShipLastKnownStateStore`.
- Tao `ShipTopicRouter`.
- Tao `InvalidShipRecord` va publish vao `invalid-telemetry-dlq`.
- Them unit/integration tests cho dedup, key mismatch, out-of-order, kinematic invalid.

### `service-broadcaster`
- Them `trackingMode` vao session viewport state.
- Tao `ShipViewportMessageHandler`.
- Tao `ShipSpatialPushEngine`.
- Tao `ShipSessionPushService` voi server destination `/topic/ships`.
- Them tests cho mode isolation va stale-session cleanup.

### `frontend-ui`
- Tao `TrackingMode` store.
- Them feature flag `shipTrackingEnabled`.
- Tao `useShipSocket`.
- Tao ship ref store/layer data transform.
- Tao ship feature layer marker co ban.
- Them mode toggle trong toolbar.
- Them tests cho mode switch, clear state, WS reconnect, domain isolation.

### `connectors`
- Tao `normalize_mmsi`.
- Tao 1 connector mau cho source da chot.
- Them parser fixture tests.
- Them timeout/retry/rate-limit config.

### Infrastructure and docs
- Them `raw-ais` va `live-ais` vao topic creation script.
- Update [topic-contracts.md](/C:/Users/NamP7/Documents/workspace/2026/tracking-2026/docs/topic-contracts.md).
- Update runbook/env templates cho connector moi.

## Phase 1 Gate

- Ship data di tu connector -> ingest -> processing -> WS -> UI.
- Aircraft live path khong bi regression.
- Ship mode va aircraft mode khong nhan cheo du lieu.
- Feature co the tat bang config/flag.

## Phase 2 - Storage and History

- Tao migration `vessel_positions`.
- Tao ship persistable model.
- Tao `ShipJdbcBatchWriter`.
- Tao `ShipStorageConsumerWorker`.
- Them `historical-ais` neu can.
- Them tests cho idempotent writes va malformed payload quarantine.

## Phase 2 Gate

- Position rows duoc persist idempotent.
- Query 1 vessel theo `mmsi` va time duoc.
- Storage pressure khong anh huong aircraft path.

## Phase 3 - Multi-source

- Them source thu 2.
- Chot source precedence policy.
- Them duplicate cross-source tests.
- Theo doi duplicate push rate va duplicate storage rate.

## Phase 3 Gate

- Khong double-push marker cho cung vessel trong viewport.
- Khong tang duplicate records bat thuong trong DB.

## Phase 4 - Enrichment and UX

- Can nhac `vessel_profiles`.
- Them profile popup/details.
- Them trail/history neu da co storage foundation.
- Danh gia image enrichment chi khi source va cache strategy ro rang.
