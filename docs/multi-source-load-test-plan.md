# Multi-Source E2E Load Test Plan v2

## QA / Tech Lead Review

### Critical findings fixed
1. `perf/k6/ingestion-load.js` was posting a raw JSON array to `/api/v1/ingest/adsb/batch`, while `service-ingestion` requires `{ "records": [...] }`. This made the original plan non-runnable.
2. The original document mixed two runtime topologies:
   - local bootRun services on `8080-8085`
   - Docker E2E app stack on `18080-18085`
   The commands were switching between both without an explicit boundary.
3. Admin bootstrap login used the wrong default password (`admin123`). Actual local/bootstrap password is `Admin@12345678`.
4. Multi-source execution depended on manually opening 5 terminals, which is not reproducible and does not generate a machine-readable manifest.
5. The old plan focused mostly on happy-path throughput. It did not systematically cover correctness, abuse, degraded downstream behavior, revocation during load, or report generation.
6. Negative-path runs (`400`, `401`, `413`) must be treated as expected responses inside k6. Otherwise `http_req_failed` creates false FAIL results.
7. Revoke flow should be automated, not copied from an ad-hoc curl block.
8. Correctness checks like duplicate resistance and source spoof immunity need storage-level verification, not only counters.

### Coverage gaps added in v2
1. Happy-path throughput by phase.
2. Auth and source-isolation behavior under load.
3. Correctness cases:
   - duplicate payloads
   - historical events
   - source-id spoof in body vs trusted header
   - structurally invalid records
4. Resilience cases:
   - revoked API key during active load
   - admission reject / producer unavailable observation
   - alert sanity under normal load
5. Reproducibility:
   - source catalog in JSON
   - API key provisioning script
   - phased runner
   - Prometheus polling
   - Markdown report generator
   - bundle assembler for `warmup -> ramp -> sustained -> peak`
   - revoke helper
   - storage consistency verifier
6. Synthetic telemetry correctness:
   - each `icao` follows a deterministic trajectory derived from absolute `event_time`
   - source ICAO ranges stay disjoint under configured VU ceilings
   - phase restarts do not reset aircraft position and trigger false kinematic DLQ

## Objective

Verify pipeline `P1 -> P9` with `5` radar sources running concurrently at `50k-100k msg/s` aggregate, while collecting enough evidence to judge:
- throughput
- latency
- data correctness
- revocation behavior
- observability completeness
- stability over time

## Artifacts

- Source catalog: `perf/config/multi-source-sources.json`
- Load generator: `perf/k6/ingestion-load.js`
- API key provisioner: `perf/scripts/provision-multi-source-api-keys.sh`
- Phase runner: `perf/scripts/run-multi-source-load.sh`
- Prometheus poller: `perf/scripts/poll-prometheus.sh`
- Report generator: `perf/scripts/generate-multi-source-report.sh`
- Bundle assembler: `perf/scripts/assemble-multi-source-bundle.sh`
- Revoke helper: `perf/scripts/revoke-source-api-key.sh`
- Storage verifier: `perf/scripts/verify-storage-consistency.sh`

## Runtime modes

### Mode A: Local bootRun

Use this when all backend services run directly on host:
- gateway: `http://localhost:8080`
- auth: `http://localhost:8081`
- ingestion: `http://localhost:8082`
- broadcaster: `http://localhost:8083`
- storage: `http://localhost:8084`
- processing: `http://localhost:8085`

### Mode B: Docker E2E app stack

Use this when services run via app compose / E2E containers:
- gateway: `http://localhost:18080`
- auth: `http://localhost:18081`
- ingestion: `http://localhost:18082`
- broadcaster: `http://localhost:18083`
- storage: `http://localhost:18084`
- processing: `http://localhost:18085`

Pick one mode and keep it consistent for the whole test window.

## Source configuration

Canonical source profiles are stored in `perf/config/multi-source-sources.json`.

| Source ID | Region | Ramp msg/s | Sustained msg/s | Peak msg/s | Batch size |
|---|---|---:|---:|---:|---:|
| `RADAR-HN` | Ha Noi | 10,000 | 10,000 | 20,000 | 1000 |
| `RADAR-HCM` | Ho Chi Minh City | 15,000 | 15,000 | 20,000 | 1000 |
| `RADAR-DN` | Da Nang | 10,000 | 10,000 | 20,000 | 1000 |
| `RADAR-HP` | Hai Phong | 20,000 | 20,000 | 20,000 | 1000 |
| `RADAR-CT` | Can Tho | 15,000 | 15,000 | 20,000 | 1000 |
| **Total** | | **70,000** | **70,000** | **100,000** | |

## Preconditions

### 1. Infra
```bash
docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env.example up -d
./infrastructure/kafka/create-topics.sh
```

### 2. Observability

For local bootRun on `8080-8085`:
```bash
docker compose -f infrastructure/docker-compose-observability.yml --env-file infrastructure/.env.example up -d
```

For Docker E2E app stack on `18080-18085`:
```bash
SERVICE_GATEWAY_METRICS_TARGET=host.docker.internal:18080 \
SERVICE_AUTH_METRICS_TARGET=host.docker.internal:18081 \
SERVICE_INGESTION_METRICS_TARGET=host.docker.internal:18082 \
SERVICE_BROADCASTER_METRICS_TARGET=host.docker.internal:18083 \
SERVICE_STORAGE_METRICS_TARGET=host.docker.internal:18084 \
SERVICE_PROCESSING_METRICS_TARGET=host.docker.internal:18085 \
docker compose -f infrastructure/docker-compose-observability.yml --env-file infrastructure/.env.example up -d
```

### 3. Services

Start services according to `docs/runbook.md`.

Example local bootRun:
```bash
./gradlew :service-auth:bootRun --args='--spring.profiles.active=local' &
./gradlew :service-ingestion:bootRun --args='--spring.profiles.active=local' &
./gradlew :service-processing:bootRun --args='--spring.profiles.active=local' &
./gradlew :service-storage:bootRun --args='--spring.profiles.active=local' &
./gradlew :service-broadcaster:bootRun --args='--spring.profiles.active=local' &
sleep 30
./gradlew :service-gateway:bootRun --args='--spring.profiles.active=local' &
```

### 4. Health gate
```bash
for port in 8081 8082 8083 8084 8085 8080; do
  echo "Port $port: $(curl -fsS http://localhost:$port/actuator/health | jq -r .status)"
done
curl -fsS http://localhost:9090/-/ready
curl -fsS http://localhost:3000/api/health
curl -fsS http://localhost:9411/health
```

### 5. Provision API keys

Local bootRun:
```bash
PUBLIC_BASE_URL=http://localhost:8080 perf/scripts/provision-multi-source-api-keys.sh
```

Docker E2E app stack:
```bash
PUBLIC_BASE_URL=http://localhost:18080 perf/scripts/provision-multi-source-api-keys.sh
```

This generates:
- `perf/.generated/multi-source-api-keys.json`
- `perf/.generated/multi-source-api-keys.env`

For storage verification on Docker E2E app stack, `perf/scripts/verify-storage-consistency.sh` auto-detects the app database from `tracking-e2e-storage`. Override `POSTGRES_DB` only if you run against a different topology.

## Test matrix

### A. Happy-path load phases

| Phase | Duration | Sources | Aggregate target | Goal |
|---|---|---|---:|---|
| Warm-up | 2m | 1 source | 10k msg/s | validate pipeline and metrics |
| Ramp | 5m | 5 sources | 70k msg/s | verify concurrency and stability |
| Sustained | 10m | 5 sources | 70k msg/s | detect memory/lag drift |
| Peak | 2m | 5 sources | 100k msg/s | verify burst tolerance |

### B. Correctness and abuse cases

| Case | How to run | Expected |
|---|---|---|
| Duplicate records | `DUPLICATE_RATIO=0.05` | processing duplicate counter rises, no storage duplicates |
| Historical records | `HISTORICAL_RATIO=0.05 HISTORICAL_SKEW_MS=300000` | historical publish rate > 0, WS still excludes historical |
| Source spoof in body | `SOURCE_ID_MISMATCH_RATIO=1` | stored/effective source remains trusted header source |
| Future event skew | `FUTURE_EVENT_RATIO=0.05 FUTURE_EVENT_SKEW_MS=60000` | pipeline stays stable, event handled without crash |
| Invalid payload batch | `INVALID_RATIO=1 INVALID_MODE=lat ACCEPTED_STATUS_CODES=400` | gateway/ingestion reject with `400`, validation counter rises |
| Oversized batch | `BATCH_SIZE=1001 ACCEPTED_STATUS_CODES=413` | ingestion returns `413` |
| Revoked key during load | revoke one source key mid-run | source traffic starts failing `401/403`, others continue |

### C. Security / gateway cases

| Case | Verify |
|---|---|
| Gateway security headers | `curl -I` contains `X-Content-Type-Options`, `X-Frame-Options` |
| No invalid 429 spike under normal load | rate-limit only blocks actual over-limit behavior |
| Centralized auth | all happy-path requests are authenticated by API key |
| Revocation propagation | revoke event blocks traffic within SLA |

### D. Observability cases

| Case | Expected |
|---|---|
| Prometheus targets up | all `service-*` active scrape targets stay `up` |
| Grafana panels populated | runtime dashboard shows data for gateway/ingestion/processing/storage/broadcaster |
| Zipkin traces visible | request -> ingest -> kafka -> processing -> storage/broadcaster chain visible |
| Alerts under normal load | no unexpected firing alerts |

## Execution

### 1. Warm-up
```bash
PUBLIC_BASE_URL=http://localhost:18080 \
PROMETHEUS_BASE_URL=http://localhost:9090 \
RUN_ID=multi-source-20260301-1100 \
perf/scripts/run-multi-source-load.sh warmup
```

### 2. Ramp
```bash
PUBLIC_BASE_URL=http://localhost:18080 \
PROMETHEUS_BASE_URL=http://localhost:9090 \
RUN_ID=multi-source-20260301-1100 \
perf/scripts/run-multi-source-load.sh ramp
```

### 3. Sustained
```bash
PUBLIC_BASE_URL=http://localhost:18080 \
PROMETHEUS_BASE_URL=http://localhost:9090 \
RUN_ID=multi-source-20260301-1100 \
perf/scripts/run-multi-source-load.sh sustained
```

### 4. Peak
```bash
PUBLIC_BASE_URL=http://localhost:18080 \
PROMETHEUS_BASE_URL=http://localhost:9090 \
RUN_ID=multi-source-20260301-1100 \
perf/scripts/run-multi-source-load.sh peak
```

### 5. Correctness / abuse sub-runs

Duplicate-focused run:
```bash
PUBLIC_BASE_URL=http://localhost:18080 \
RUN_ID=multi-source-20260301-dup \
DUPLICATE_RATIO=0.05 \
perf/scripts/run-multi-source-load.sh warmup
```

Historical-focused run:
```bash
PUBLIC_BASE_URL=http://localhost:18080 \
RUN_ID=multi-source-20260301-historical \
HISTORICAL_RATIO=0.05 \
perf/scripts/run-multi-source-load.sh warmup
```

Invalid batch run:
```bash
PUBLIC_BASE_URL=http://localhost:18080 \
RUN_ID=multi-source-20260301-invalid \
INVALID_RATIO=1 \
INVALID_MODE=lat \
ACCEPTED_STATUS_CODES=400 \
perf/scripts/run-multi-source-load.sh warmup
```

Oversized batch run:
```bash
PUBLIC_BASE_URL=http://localhost:18080 \
RUN_ID=multi-source-20260301-oversized \
BATCH_SIZE=1001 \
ACCEPTED_STATUS_CODES=413 \
perf/scripts/run-multi-source-load.sh warmup
```

### 6. Revoke one source during load

Start sustained run, then in another terminal:
```bash
PUBLIC_BASE_URL=http://localhost:18080 \
perf/scripts/revoke-source-api-key.sh RADAR-HN
```

Expected:
- only `RADAR-HN` starts failing
- other `4` sources continue
- ingestion revocation metric rises and revoked source starts returning `401/403`

## Verification checkpoints

### P1-P3 Auth + Gateway

| Checkpoint | Verify | Expected |
|---|---|---|
| 5 API keys authenticated | per-source k6 summary | expected-status rate `>= 99%` |
| No invalid normal-load throttling | Prometheus + k6 | `429` under normal path `< 0.5%` |
| Security headers present | `curl -I ${PUBLIC_BASE_URL}/api/v1/auth/login` | `X-Content-Type-Options`, `X-Frame-Options` |
| Revocation works during load | revoke one source | revoked source blocked, others unaffected |

### P4 Ingestion

| Checkpoint | PromQL / Verify | Expected |
|---|---|---|
| Accept throughput | `sum(rate(tracking_ingestion_accepted_batch_records_total[1m]))` | close to target |
| Publish throughput | `sum(rate(tracking_ingestion_kafka_published_total[1m]))` | tracks accept rate |
| Admission rejects | `sum(rate(tracking_ingestion_rejected_admission_total[1m]))` | `0` under normal load |
| Producer unavailable rejects | `sum(rate(tracking_ingestion_rejected_producer_unavailable_total[1m]))` | `0` under normal load |
| Validation rejects in invalid run | `sum(rate(tracking_ingestion_rejected_validation_total[1m]))` | `> 0` only in invalid scenario |
| Trace propagation | Zipkin | `traceparent` visible end-to-end |

### P5 Processing

| Checkpoint | PromQL / Verify | Expected |
|---|---|---|
| Pipeline latency p95 | `histogram_quantile(0.95,sum(rate(tracking_processing_pipeline_latency_seconds_bucket[1m])) by (le))` | `< 200ms` |
| Live publish rate | `sum(rate(tracking_processing_published_live_total[1m]))` | `> 0` |
| Historical publish rate | `sum(rate(tracking_processing_published_historical_total[1m]))` | near `0` in normal run, `> 0` in historical run |
| DLQ rate | `sum(rate(tracking_processing_published_dlq_total[1m]))` | `< 0.1%` of total |
| Duplicate drop | `sum(rate(tracking_processing_pipeline_dropped_duplicate_total[1m]))` | `> 0` in duplicate run |
| Kinematic reject | `sum(rate(tracking_processing_pipeline_rejected_kinematic_total[1m]))` | low under normal run |

### P6 Storage

| Checkpoint | PromQL / Verify | Expected |
|---|---|---|
| Batch latency p95 | `histogram_quantile(0.95,sum(rate(tracking_storage_batch_latency_seconds_bucket[1m])) by (le))` | `< 300ms` |
| Buffer size | `max(tracking_storage_buffer_size)` | stable and `< 50000` |
| Batch failures | `sum(increase(tracking_storage_batch_failed_total[5m]))` | `0` |
| Rows written | `sum(rate(tracking_storage_rows_written_total[1m]))` | close to accepted live+historical rate |
| Idempotency | `SOURCE_ID=RADAR-HN perf/scripts/verify-storage-consistency.sh duplicates` | duplicate groups = `0`, duplicate rows = `0` |
| Source spoof immunity | `SOURCE_ID=RADAR-HN perf/scripts/verify-storage-consistency.sh source-spoof` | trusted rows `> 0`, spoofed rows = `0` |
| Historical persistence | `SOURCE_ID=RADAR-HN perf/scripts/verify-storage-consistency.sh historical` | historical rows `> 0` in historical scenario |

### P7 Broadcaster

| Checkpoint | PromQL / Verify | Expected |
|---|---|---|
| Active sessions | `max(ws_sessions_active)` | stable |
| Push latency p95 | `histogram_quantile(0.95,sum(rate(ws_push_latency_seconds_bucket[1m])) by (le))` | `< 100ms` |
| Historical filtered from WS | browser / consumer evidence | no historical pushed realtime |
| Spatial filtering | viewport client | only in-bounds flights |

### P8 Frontend

| Checkpoint | Verify | Expected |
|---|---|---|
| Map renders smoothly | browser manual check | no freeze / no stutter spike |
| No token leak to console | DevTools | no access token printed |
| WS survives load | browser manual + broadcaster metrics | live updates continue |

### P9 Observability

| Checkpoint | Verify | Expected |
|---|---|---|
| Prometheus targets | `/api/v1/targets` | all `service-*` are `up` |
| Dashboard has data | Grafana | runtime panels populated |
| Alerts normal-load sanity | Prometheus alerts | no unexpected firing alerts |
| Trace visibility | Zipkin | traces sampled and searchable |

## Prometheus collection

One-off snapshot:
```bash
PROMETHEUS_BASE_URL=http://localhost:9090 RUN_ONCE=1 \
OUTPUT_FILE=perf/.generated/prometheus-once.ndjson \
perf/scripts/poll-prometheus.sh
```

Continuous polling:
```bash
PROMETHEUS_BASE_URL=http://localhost:9090 \
OUTPUT_FILE=perf/reports/multi-source-20260301-1100/manual-prometheus.ndjson \
INTERVAL_SECONDS=60 \
DURATION_SECONDS=1200 \
perf/scripts/poll-prometheus.sh
```

## Report generation

```bash
perf/scripts/generate-multi-source-report.sh perf/reports/multi-source-20260301-1100
```

Generated output:
- `manifest.tsv`
- `*-summary.json`
- `*-prometheus.ndjson`
- `report.md`

`report.md` includes:
- throughput and latency per phase/source
- expected-status rate
- error taxonomy counters: `2xx`, `4xx`, `5xx`, `401`, `413`, `429`, `503`

## Exit criteria

| Criteria | Threshold |
|---|---|
| Per-source expected-status rate | `>= 99%` |
| Ingestion p95 latency | `< 750ms` |
| Ingestion p99 latency | `< 1200ms` |
| Processing DLQ ratio | `< 0.1%` |
| Storage batch failures | `0` |
| Storage buffer plateau | `< 50000` |
| Dropped iterations | `0` |
| Normal-load alerts firing | `0` |
| JVM heap slope | stable, not linear upward |
| Revocation blast radius | only revoked source impacted |
| Duplicate rows in storage | `0` in duplicate run |
| Spoofed source rows in storage | `0` in spoof run |

## Final QA sign-off checklist

- [ ] All four happy-path phases completed.
- [ ] At least one invalid / abuse run completed.
- [ ] Revocation during active load verified.
- [ ] Report generated from actual summary files, not manually edited.
- [ ] Prometheus snapshots saved with run artifacts.
- [ ] Any deviations from thresholds documented with root cause and follow-up.
