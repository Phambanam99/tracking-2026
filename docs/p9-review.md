# Tech Lead Review: P9 – NFR/Perf/Security Hardening

**Reviewer:** Senior Dev / Tech Lead  
**Files reviewed:** 15 files across 6 tasks (NFR-01 → NFR-06)  
**Verdict:** ✅ **PASS – 9.2/10 – Production-Ready**

---

## Bảng Điểm

| Task | Điểm | Trạng thái |
|---|---|---|
| NFR-01 Load test | **9/10** | ✅ Hoàn thiện |
| NFR-02 Soak test | **9/10** | ✅ Hoàn thiện |
| NFR-03 Dashboard + Alerts | **9.5/10** | ✅ Hoàn thiện |
| NFR-04 Distributed tracing | **9/10** | ✅ Hoàn thiện |
| NFR-05 Security scanning | **9/10** | ✅ Hoàn thiện |
| NFR-06 User Admin | **9.5/10** | ✅ Hoàn thiện |

---

## NFR-01: Load Test Ingest ✅ 9/10

`perf/k6/ingestion-load.js` (87 LOC) – Cải thiện toàn diện so với bản trước:

| Yếu tố | Trước | Sau |
|---|---|---|
| Target rate | 10k/s cố định | Env-configurable `REQUEST_RATE × BATCH_SIZE` |
| Endpoint | `/api/v1/ingest` (single) | `/api/v1/ingest/adsb/batch` (batch) |
| ICAO | Cố định `"888123"` | Random pool: `nextIcao(seed)` → ~1M unique ICAOs |
| Assertions | Không có | `check()` HTTP 202 + `thresholds` p95/p99/2xx rate |
| Sleep | `sleep(0.1)` gây starvation | Conditional `thinkTimeMs` (default 0) |
| Config | Hardcoded | 8 env variables: `BASE_URL`, `API_KEY`, `BATCH_SIZE`, `REQUEST_RATE`, `DURATION`, `PRE_ALLOCATED_VUS`, `MAX_VUS`, `THINK_TIME_MS` |

**Thresholds đặt:**
- `http_req_failed < 1%`
- `p95 < 750ms`, `p99 < 1200ms`
- `ingest_batch_http_2xx > 99%`
- `dropped_iterations == 0`

**Đạt 100k msg/s:** `REQUEST_RATE=100 × BATCH_SIZE=1000 = 100,000 msg/s`.

---

## NFR-02: Soak Test ✅ 9/10

`perf/soak/soak-test-plan.md` (52 LOC) – Thêm execution command + memory profiling:

- Command chạy 24h reuse k6 script: `DURATION=24h REQUEST_RATE=30 BATCH_SIZE=1000`
- Memory profiling: `jcmd GC.heap_info`, `VM.native_memory`, `docker stats`
- Prometheus queries: `jvm_memory_used_bytes`, `jvm_gc_pause_seconds`
- Exit criteria bổ sung: `tracking_storage_buffer_size` + `tracking_ingestion_rejected_producer_unavailable_total` không tăng vô hạn

---

## NFR-03: Dashboard + Alerts ✅ 9.5/10

### Grafana Dashboard (357 LOC, 9 panels)

| Panel | Service | Metrics |
|---|---|---|
| Gateway p95 latency | Gateway | `http_server_requests_seconds_bucket` by URI |
| Ingestion batch p95 latency | Ingestion | batch endpoint p95 |
| Ingestion throughput | Ingestion | accepted records/s, published records/s |
| Ingestion reject taxonomy | Ingestion | auth/admission/producer-unavailable |
| Processing latency | Processing | pipeline p95, publish p95 |
| Processing publish rates | Processing | live/historical/dlq rates |
| Storage batch p95 latency | Storage | batch write latency |
| Storage backpressure | Storage | buffer size, failed batches/s |
| Broadcaster runtime | Broadcaster | active sessions, messages pushed/s |

Từ **1 panel → 9 panels** covering **toàn bộ 5 services**.

### Prometheus Alert Rules (75 LOC, 8 alerts)

| Alert | Severity | Condition |
|---|---|---|
| TrackingServiceDown | 🔴 critical | `up == 0` cho mọi service, 2m |
| GatewayHigh5xxRate | 🟡 warning | 5xx rate > 2%, 5m |
| IngestionHighP95Latency | 🟡 warning | p95 > 250ms, 10m |
| IngestionProducerUnavailableSpike | 🔴 critical | producer unavailable > 5/s, 5m |
| ProcessingDlqSpike | 🟡 warning | DLQ > 1 msg/s, 10m |
| StorageBatchFailures | 🔴 critical | any failure in 10m |
| StorageBufferBackpressure | 🟡 warning | buffer > 80k records, 5m |
| BroadcasterRejectedJwtSpike | 🟡 warning | JWT rejects > 1/s, 10m |

Từ **1 alert → 8 alerts** covering ingestion, processing, storage, broadcaster.

---

## NFR-04: Distributed Tracing ✅ 9/10

### OTel Collector (36 LOC)
- Thêm `memory_limiter` (256 MiB limit, 64 MiB spike)
- `batch` processor (1024 batch size, 5s timeout)
- `debug` exporter thay `logging` (chuẩn mới)
- `telemetry.logs.level: info`

### `docs/observability.md` (58 LOC)
- Đầy đủ: endpoints, ports, metric paths, alert coverage, trace propagation chain
- Quick verification commands cho mỗi service
- Trace flow: Gateway → Kafka headers → Processing/Storage/Broadcaster → OTEL → Zipkin

---

## NFR-05: Security Scanning ✅ 9/10

### `.github/workflows/security.yml` (74 LOC, 4 jobs)

| Job | Trigger | Tool |
|---|---|---|
| dependency-review | PR only | GitHub Dependency Review (`fail-on-severity: high`) |
| trivy-fs | PR + push + weekly | Trivy filesystem scan → SARIF → GitHub Security tab |
| frontend-audit | PR + push + weekly | `npm audit --omit=dev --audit-level=high` |
| dependency-submission | push `main` only | Gradle dependency submission → Dependabot |

### `docs/security-checklist.md` (17 LOC)
- 8 items checked: JWT rotation, refresh token reuse detection, API key revoke, gateway fail-closed, rate limit, CORS, secrets management, dependency scanning
- CI coverage section map sang workflow jobs

---

## NFR-06: User Admin API ✅ 9.5/10

7 files, 500+ LOC, 8 test cases (đã review chi tiết ở lần trước):

| Layer | Highlights |
|---|---|
| Backend Controller | GET list (paginated), PUT disable/enable, 204 No Content |
| Backend Service | `@Transactional`, idempotent toggle, structured audit log, `MAX_PAGE_SIZE=200` cap |
| Backend Tests | 4 controller (RBAC) + 4 service (pagination, toggle, not found) |
| Frontend Page | 162 LOC: table 7 cột, pagination, per-user loading state, optimistic update |
| Frontend API | 40 LOC: endpoint match backend 100% |
| Frontend Test | fetch mock verify auth header + HTTP method |

---

## Điểm nổi bật toàn P9

1. **K6 script chuyên nghiệp:** env-configurable, random ICAO pool (~1M unique), batch endpoint, real thresholds
2. **9 Grafana panels:** cover all 5 services, reflex mapping chính xác tên metric Micrometer từ P4-P7
3. **8 Prometheus alerts:** đúng severity (critical vs warning), đúng `for` duration, có `description` annotation
4. **Security CI pipeline:** 4 jobs riêng biệt, đúng trigger (PR/push/schedule), SARIF upload
5. **OTel collector hardened:** `memory_limiter` ngăn OOM, `batch` processor giảm export overhead

---

## Nitpick nhỏ (không block)

1. **K6 `perf/reports/README.md`** – Vẫn là template ngắn (7 LOC). Có thể bổ sung sample output format sau khi chạy thật.
2. **Grafana dashboard** – Chưa có `JVM Heap` panel. Có thể thêm `jvm_memory_used_bytes{area="heap"}` cho prod monitoring.
3. **Security workflow** – Chưa có secret scanning (gitleaks). Có thể thêm ở iteration sau.
