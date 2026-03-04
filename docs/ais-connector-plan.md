# AIS Connectors Implementation Plan (AISStream + SignalR)

## 1) Mục tiêu

Triển khai 2 Python connector thay thế service TypeScript hiện tại:
- `connectors/ais-aistream.service.ts` -> `connectors/aisstream_connector.py`
- `connectors/ais-signalr.service.ts` -> `connectors/ais_signalr_connector.py`

Hai connector phải theo đúng pattern đang dùng trong repo:
- Kế thừa `BaseConnector` trong `connectors/common.py`
- Gửi batch qua `GatewayIngestClient` tới `/api/v1/ingest/ais/batch`
- Có test unit và env template tương tự các connector hiện có (`chinaport`, `fr24`, `radarbox`)

## Trạng thái triển khai

- 2026-03-04: Phase 1 hoàn tất.
  - Đã refactor helper AIS dùng chung vào `connectors/common.py`
  - Đã chuyển `chinaport_connector.py` sang dùng helper shared
  - Đã thêm scaffold entrypoint cho `aisstream` và `signalr`
  - Đã thêm env template cho `aisstream` và `ais_signalr`
  - Đã cập nhật `run_connector.sh` để nhận `aisstream|signalr`
  - Test suite connectors: pass
- 2026-03-04: Phase 2 hoàn tất.
  - Đã implement `connectors/aisstream_connector.py` (streaming, transform, batching, reconnect loop)
  - Đã thêm unit tests `connectors/tests/test_aisstream_connector.py`
  - Đã cập nhật `connectors/requirements.txt` với `websocket-client`
  - Đã cập nhật docs runtime trong `connectors/README.md`
  - Test suite connectors: pass
- 2026-03-04: Phase 3 hoàn tất.
  - Đã implement `connectors/ais_signalr_connector.py` (dynamic query, timezone normalize, QueryData transform, incremental lower-bound, REST trigger, reconnect loop)
  - Đã thêm unit tests `connectors/tests/test_ais_signalr_connector.py`
  - Đã cập nhật `connectors/requirements.txt` với `signalrcore`
  - Đã cập nhật docs runtime trong `connectors/README.md`
  - Test suite connectors: pass
- 2026-03-04: Phase 4 hardening hoàn tất (baseline).
  - Đã thêm dedupe batch shared trong `connectors/common.py`
  - Đã thêm buffer cap + drop policy cho AISStream/SignalR
  - Đã thêm flush observability log: `raw`, `deduped`, `dropped_total`, `accepted`
  - Đã bổ sung test hardening (dedupe + overflow)
  - Đã bổ sung runbook vận hành nhanh trong `connectors/README.md`
  - Đã thêm service vận hành `aisstream-connector`, `ais-signalr-connector` trong `infrastructure/docker-compose-connectors.yml`
  - Đã thêm env runtime mẫu `connectors/env/aisstream.env`, `connectors/env/ais_signalr.env`
  - Đã validate compose config: parse thành công
  - Đã thêm preflight script `connectors/smoke_ais_connectors.py` để kiểm tra config/dependency/instantiate trước live smoke
  - Test suite connectors: pass

---

## 2) Review plan hiện tại

### Điểm mạnh
- Đã xác định đúng nguồn dữ liệu, protocol và flow của từng connector.
- Có mapping field rõ giữa source payload và record normalize.
- Đã có hướng batching, reconnect, incremental query.
- Có test idea tương đối đầy đủ cho transform core.

### Điểm yếu cần bổ sung trước khi code
- Chưa có tiêu chí Done/Acceptance cho từng phase.
- Chưa chốt contract record AIS chuẩn (field required/optional, type, range).
- Chưa có kế hoạch idempotency/dedup khi reconnect hoặc polling overlap.
- Chưa có kế hoạch observability (metrics, structured logs, health signal).
- Chưa chốt strategy backpressure khi gateway lỗi kéo dài (429/5xx).
- Chưa có compatibility matrix cho thư viện SignalR (ưu tiên + fallback rõ ràng).
- Chưa có runbook vận hành (env tối thiểu, command chạy local, cách debug).
- Bản cũ lỗi encoding, khó review và dễ sai khi team triển khai.

---

## 3) Technical decisions cần chốt

### 3.1 Contract bản ghi AIS ingest
Record chuẩn gửi gateway:
- Required: `mmsi`, `lat`, `lon`, `event_time`, `source_id`
- Optional: `vessel_name`, `speed`, `course`, `heading`, `nav_status`
- `event_time`: epoch millis UTC
- Validation:
  - `mmsi`: 9 digits
  - `lat` in [-90, 90], `lon` in [-180, 180]
  - bỏ record `lat=0 && lon=0`

### 3.2 Dedupe strategy
- Trong mỗi batch: dedupe theo key `(mmsi, event_time, lat, lon, source_id)`.
- Với SignalR incremental: `last_lower_bound = max_event_time_seen + 60s`.
- Không cố giữ cache dedupe vô hạn trong RAM.

### 3.3 Backpressure + retry ingest
- Retry HTTP ingest với exponential backoff + jitter.
- Nếu vượt `max_retry`: drop batch và log error có `dropped_count`.
- Giới hạn buffer trong RAM (ví dụ 20_000 records) để tránh OOM.

### 3.4 Logging/metrics tối thiểu
- Structured log fields: `connector`, `source`, `batch_size`, `ingested`, `dropped`, `latency_ms`, `error`.
- Counters:
  - `records_received_total`
  - `records_valid_total`
  - `records_dropped_total`
  - `ingest_batches_total`
  - `ingest_failures_total`
  - `reconnect_total`

---

## 4) Implementation design

## 4.1 AISStream connector (`aisstream_connector.py`)

### Flow
1. Mở WebSocket `wss://stream.aisstream.io/v0/stream`
2. Gửi subscription message (API key + bounding boxes)
3. Nhận message liên tục, parse/transform
4. Buffer và flush theo `batch_size` hoặc `flush_interval`
5. Khi disconnect: flush phần còn lại, reconnect theo backoff

### Env
- `AISSTREAM_API_KEY` (required)
- `AISSTREAM_ENDPOINT` (default: `wss://stream.aisstream.io/v0/stream`)
- `AISSTREAM_BOUNDING_BOXES` (JSON)
- `AISSTREAM_BATCH_SIZE` (default: 50)
- `AISSTREAM_FLUSH_INTERVAL_SECONDS` (default: 5)
- `AISSTREAM_RECONNECT_DELAY_SECONDS` (default: 5)
- `AISSTREAM_MAX_RECONNECT_ATTEMPTS` (default: 20)

### Acceptance
- Nhận được stream thật và ingest thành công vào gateway.
- Reconnect tự động sau disconnect.
- Không crash khi gặp payload lỗi hoặc field thiếu.

## 4.2 AIS SignalR connector (`ais_signalr_connector.py`)

### Flow
1. Connect hub SignalR
2. Register handlers: `QueryCount`, `QueryData`, `QueryEnd`
3. Trigger query qua REST theo chu kỳ
4. Transform + buffer + ingest
5. Cập nhật incremental lower-bound nếu bật incremental mode

### Time handling (critical)
- Source gửi timestamp GMT+7 nhưng có thể có suffix `Z` giả.
- Chuẩn hóa:
  - strip `Z` nếu fake
  - parse theo GMT+7
  - convert về UTC epoch millis

### Env
- `AIS_HOST` (required)
- `AIS_DEVICE`, `AIS_ACTION_TYPE`, `AIS_QUERY`, `AIS_USER_ID`
- `AIS_QUERY_LATEST_BEFORE_STREAM`
- `AIS_QUERY_MINUTES` (default: 10)
- `AIS_QUERY_INCREMENTAL` (default: true)
- `AIS_USING_LAST_UPDATE_TIME`
- `AIS_AUTO_TRIGGER` (default: true)
- `AIS_AUTO_TRIGGER_INTERVAL_MS` (default: 15000)
- `AIS_SIGNALR_RECONNECT_DELAY_SECONDS` (default: 30)

### Acceptance
- Trigger query thành công và nhận event payload qua hub.
- Timezone chuẩn UTC trong DB.
- Incremental mode giảm duplicate so với full lookback.

---

## 5) Shared code changes

Refactor vào `connectors/common.py`:
- `normalize_mmsi`
- `normalize_text`
- `parse_event_time_ms`
- `convert_gmt7_to_utc` (mới)
- `completeness_score_ais` (mới)

Yêu cầu:
- Không làm gãy connector hiện hữu (`chinaport`, `fr24`, `radarbox`).
- Test `connectors/tests/test_common.py` phải pass sau refactor.

---

## 6) Test plan (bắt buộc)

## 6.1 Unit tests mới
- `connectors/tests/test_aisstream_connector.py`
- `connectors/tests/test_ais_signalr_connector.py`

Coverage tối thiểu:
- Transform valid + invalid
- Fallback field logic
- Timestamp parsing/timezone conversion
- Batch flush theo size và interval
- Reconnect loop behavior
- Incremental query advancement
- Ingest retry + drop behavior

## 6.2 Contract tests với gateway client (mock HTTP)
- Verify payload shape gửi `/api/v1/ingest/ais/batch`
- Verify retry/backoff khi nhận 429/5xx
- Verify stop retry khi nhận 4xx non-retriable

## 6.3 Smoke test manual
- Run local qua `run_connector.sh`
- Kiểm tra logs + record vào DB/query API
- Test disconnect/reconnect và network flap

---

## 7) Infra/config updates

- `connectors/requirements.txt`:
  - `websocket-client>=1.7.0`
  - `pysignalr>=1.0.0` (hoặc chốt `signalrcore`, không dùng đồng thời)
- `connectors/run_connector.sh`: thêm case `aisstream`, `signalr`
- `connectors/env/aisstream.env.example`
- `connectors/env/ais_signalr.env.example`
- `docker-compose.yml`: thêm 2 service connector mới
- `connectors/README.md`: cập nhật cách chạy và env bắt buộc

---

## 8) Phase plan (ưu tiên triển khai)

### Phase 1 (P0): Foundation
- Refactor helper AIS vào `common.py`
- Add env templates
- Add connector entrypoint trong `run_connector.sh`
- DoD: test common pass, connector import được, không regression connector cũ

### Phase 2 (P1): AISStream
- Implement streaming connector + batching + reconnect
- Implement unit tests cho AISStream
- DoD: test pass + smoke ingest local pass

### Phase 3 (P1): SignalR
- Implement SignalR connector + dynamic query + timezone normalization
- Implement unit tests cho SignalR
- DoD: test pass + smoke ingest local pass

### Phase 4 (P2): Hardening
- Retry/backpressure/dedupe tuning
- Structured logs + metrics hooks
- Docker compose + README + runbook
- DoD: soak test >= 2h không crash, memory ổn định

---

## 9) Rủi ro và giảm thiểu

- SignalR library mismatch:
  - Mitigation: PoC sớm với endpoint thật, fallback library đã chuẩn bị.
- Timezone sai lệch:
  - Mitigation: test cases edge timestamp + compare với dữ liệu chuẩn DB.
- Duplicate cao do polling overlap:
  - Mitigation: incremental lower bound + dedupe trong batch.
- Gateway downtime gây phình RAM:
  - Mitigation: buffer cap + drop policy + alert logs.

---

## 10) Ước lượng effort thực tế

- Phase 1: 0.5 ngày
- Phase 2: 1 ngày
- Phase 3: 1.5 ngày
- Phase 4: 0.5 ngày

Tổng: ~3.5 ngày làm việc (bao gồm test + smoke + hardening cơ bản).

---

## 11) Checklist Done cuối cùng

- [ ] 2 connector Python chạy được end-to-end
- [ ] Unit tests mới pass
- [ ] Không regression connector hiện hữu
- [ ] Docker compose chạy được 2 connector mới
- [ ] Có log đủ để debug production issue
- [ ] Có runbook ngắn trong README
