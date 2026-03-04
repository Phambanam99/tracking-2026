# Ship Tracking Implementation Checklist

## Current Status

### Overall estimate

- Phase 0: `90%`
- Phase 1: `90-95%`
- Phase 2: `85-90%`
- Phase 3: `0-10%`
- Phase 4: `45-55%`
- Overall plan completion: `70-75%`

### Legend

- `DONE`: da implement va da co test/build/verify hop ly
- `PARTIAL`: da co code/scaffold mot phan nhung chua dat full gate
- `MISSING`: chua lam hoac moi dung o muc plan

---

## Phase 0 - Design Lock

### Status: `PARTIAL`

- `DONE` Chot field list `CanonicalShip` va ship DTO contracts.
- `DONE` Chot topic names `raw-ais`, `live-ais`, `historical-ais`.
- `DONE` Chot MVP acceptance criteria trong plan/doc.
- `DONE` Chot feature flag rollout strategy cho backend va frontend.
- `PARTIAL` Chot source ship dau tien va xac minh licensing/rate limit.
  Current state:
  Da co ingest path/contract theo `AIS-*`, nhung chua co source profile/runbook production-grade duoc chot ro nhu phase 0 yeu cau.

### Con thieu de close phase

- Chot 1 ship source production dau tien bang tai lieu ro rang.
- Bo sung source profile/rate limit/licensing note vao docs.

---

## Phase 1 - Live MVP

### Status: `DONE` gan nhu toan bo

### `common-dto`

- `DONE` Tao `CanonicalShip`.
- `DONE` Tao `EnrichedShip`.
- `DONE` Tao `ShipMetadata`.
- `DONE` Tao `LiveShipMessage`.
- `DONE` Them serialization tests cho ship DTOs.

### `service-ingestion`

- `DONE` Tao ship ingest request model.
- `DONE` Tao ship request validator.
- `DONE` Tao `RawAisProducer`.
- `DONE` Them endpoint `/api/v1/ingest/ais`.
- `DONE` Them endpoint `/api/v1/ingest/ais/batch`.
- `DONE` Them test cho single/batch validation va keying.

### `service-processing`

- `DONE` Tao `RawAisConsumer`.
- `DONE` Tao `ShipStateFusionEngine`.
- `DONE` Tao `ShipKinematicValidator`.
- `DONE` Tao `ShipLastKnownStateStore`.
- `DONE` Tao `ShipTopicRouter`.
- `DONE` Tao ship invalid-record path va publish vao `invalid-telemetry-dlq`.
- `DONE` Them unit/integration tests cho dedup, key mismatch, out-of-order, kinematic invalid.

### `service-broadcaster`

- `DONE` Them `trackingMode` vao session viewport state.
- `DONE` Tao `ShipViewportMessageHandler`.
- `DONE` Tao `ShipSpatialPushEngine`.
- `DONE` Tao `ShipSessionPushService` voi server destination `/topic/ships`.
- `DONE` Them tests cho mode isolation.
- `PARTIAL` Stale-session cleanup coverage ship-specific.
  Current state:
  Mode isolation va push path da co test. Khong thay ro mot test stale-session cleanup ship-specific duoc tach rieng trong tracker.

### `frontend-ui`

- `DONE` Tao `TrackingMode` store.
- `DONE` Them feature flag `shipTrackingEnabled`.
- `DONE` Tao `useShipSocket`.
- `DONE` Tao ship ref store/layer data transform.
- `DONE` Tao ship feature layer marker co ban.
- `DONE` Them mode toggle trong toolbar.
- `DONE` Them tests cho mode switch, clear state, WS reconnect, domain isolation.
- `DONE` Ship popup/detail/search/trail preview/auto-fit vuot scope MVP co ban.

### `connectors`

- `MISSING` Tao `normalize_mmsi`.
- `MISSING` Tao 1 connector mau cho source da chot.
- `MISSING` Them parser fixture tests.
- `MISSING` Them timeout/retry/rate-limit config.

### Infrastructure and docs

- `DONE` Them `raw-ais` va `live-ais` vao topic creation script.
- `DONE` Update [topic-contracts.md](/C:/Users/NamP7/Documents/workspace/2026/tracking-2026/docs/topic-contracts.md).
- `PARTIAL` Update runbook/env templates cho connector moi.
  Current state:
  Da co env/config scaffolding cho ship trong services/helm/frontend. Chua thay runbook connector ship production-ready.

---

## Phase 1 Gate

### Status: `PARTIAL` nhung rat gan done

- `PARTIAL` Ship data di tu connector -> ingest -> processing -> WS -> UI.
  Current state:
  Ingest -> processing -> WS -> UI da verify.
  Phan `connector` production path chua co.
- `DONE` Aircraft live path khong bi regression theo targeted tests/build va mode isolation.
- `DONE` Ship mode va aircraft mode khong nhan cheo du lieu.
- `DONE` Feature co the tat bang config/flag.

### Con thieu de close phase sach se

- Lam xong 1 connector thuc.
- Chot stale-session cleanup test cho ship neu muon gate chat hon.

---

## Phase 2 - Storage and History

### Status: `DONE` phan lon

- `DONE` Tao migration `vessel_positions` theo huong ship positions.
- `DONE` Tao ship persistable model.
- `DONE` Tao writer/buffer/worker storage cho ship.
- `DONE` Tao `ShipStorageConsumerWorker`.
- `DONE` Them `historical-ais`.
- `PARTIAL` Tests cho malformed payload quarantine.
  Current state:
  Da co DLQ/invalid path va storage tests, nhung malformed payload quarantine o storage lane chua duoc tracking ro thanh 1 test batch rieng.
- `DONE` Query 1 vessel theo `mmsi` va time da co qua `service-query`.
- `DONE` Ship history/search query da co service, controller, DB integration tests.

---

## Phase 2 Gate

### Status: `PARTIAL` nhung thuc chat da qua duoc phan chinh

- `DONE` Position rows duoc persist idempotent.
- `DONE` Query 1 vessel theo `mmsi` va time duoc.
- `PARTIAL` Storage pressure khong anh huong aircraft path.
  Current state:
  Chua thay load/perf verification ro cho gate nay.

### Con thieu de close phase

- Them performance/pressure verification cho ship storage lane.
- Neu can, bo sung quarantine regression tests ro hon.

---

## Phase 3 - Multi-source

### Status: `MISSING`

- `MISSING` Them source thu 2.
- `MISSING` Chot source precedence policy.
- `MISSING` Them duplicate cross-source tests.
- `MISSING` Theo doi duplicate push rate va duplicate storage rate.

---

## Phase 3 Gate

### Status: `MISSING`

- `MISSING` Khong double-push marker cho cung vessel trong viewport.
- `MISSING` Khong tang duplicate records bat thuong trong DB.

---

## Phase 4 - Enrichment and UX

### Status: `PARTIAL`

- `MISSING` `vessel_profiles`.
- `PARTIAL` Them profile popup/details.
  Current state:
  Da co ship popup/detail/search/trail preview, nhung chua co profile enrichment thuc su.
- `DONE` Them trail/history foundation tren UI.
  Current state:
  Da co ship trail preview, trail window `30m/2h/6h`, auto-fit map bounds, search live/global/history.
  Theo feedback UX moi: da bo component "trail preview" khoi tab Overview trong Ship Detail; lich su hanh trinh giu o tab History rieng.
- `DONE` Tracked ships panel UX da duoc redesign va don gian hoa theo huong icon-first.
  Current state:
  Group rail + group actions + add ship by MMSI/search trong panel da co, voi action icon de giam text clutter.
  Da bo sung card hien thi ship theo group ro rang hon (icon, badge trang thai, thong tin source + event time) va doi copy "awaiting live data" de de hieu hon voi user.
  Da doi layout panel sang mo rong theo chieu doc: click group nao thi bung danh sach tau cua group do ngay ben duoi, thay vi chia ngang 2 cot.
- `DONE` Ship popup da duoc don gian hoa va dong nhat field.
  Current state:
  Bo layout telemetry/table tach rieng, doi sang 1 grid field label/value thong nhat (MMSI, type, speed, heading, position, destination, eventTime, source) de de scan nhanh.
  Da doi tiep ve list dong `label: value` khong con card o theo feedback UX.
- `DONE` Ship layer tracked-only da bo sung bo loc theo group.
  Current state:
  Khi bat `tracked only`, co them dropdown bo loc group da chon nhieu (multi-select). Neu khong chon group nao thi mac dinh hien thi tat ca group tracked.
- `DONE` Giu tau tracked tren map du khong con live update moi.
  Current state:
  Prune stale da duoc cap nhat de khong xoa tau nam trong tracked set, giup tau tracked van hien tren map voi vi tri cuoi cung da biet.
  Neu MMSI tracked chua co trong store memory, frontend se thu query global-live theo dung MMSI truoc; neu khong co moi fallback DB history API de lay diem cuoi va hien thi.
- `MISSING` Image enrichment va cache strategy cho ship.

---

## Suggested Next Steps

### Track A - Close Phase 0/1 cleanly

- Tao 1 ship connector that su.
- Chot source profile/licensing/rate-limit docs.
- Bo sung connector parser + retry/rate-limit tests.

### Track B - Close Phase 2 harder

- Them perf/pressure verification cho storage/query lane ship.
- Bo sung quarantine regression tests cho malformed payload storage path.

### Track C - Start Phase 3

- Chot source precedence rule.
- Them multi-source duplicate fixtures.
- Do duplicate push/storage metrics.

### Track D - Continue Phase 4 UX

- Them `vessel_profiles`.
- Them richer profile/detail UX.
- Can nhac highlight start/end trail points, timeline, history playback rieng cho ship.
