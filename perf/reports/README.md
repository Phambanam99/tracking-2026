# Performance Reports

## Load test command
```bash
BASE_URL=http://localhost:18080 \
API_KEY=replace-me \
BATCH_SIZE=1000 \
REQUEST_RATE=100 \
DURATION=10m \
k6 run --summary-export perf/reports/ingestion-load-summary.json perf/k6/ingestion-load.js
```

`REQUEST_RATE * BATCH_SIZE` là throughput mục tiêu theo records/giây.

## Multi-source toolkit
- Source catalog: `perf/config/multi-source-sources.json`
- Provision API keys: `perf/scripts/provision-multi-source-api-keys.sh`
- Revoke one source key: `perf/scripts/revoke-source-api-key.sh <SOURCE_ID>`
- Run phased load: `perf/scripts/run-multi-source-load.sh warmup|ramp|sustained|peak`
- Poll Prometheus snapshots: `perf/scripts/poll-prometheus.sh`
- Generate markdown report: `perf/scripts/generate-multi-source-report.sh perf/reports/<run-id>`
- Assemble multi-phase bundle: `perf/scripts/assemble-multi-source-bundle.sh perf/reports/<bundle-id> <run-dir>...`
- Verify storage consistency: `perf/scripts/verify-storage-consistency.sh duplicates|source-spoof|historical`

`verify-storage-consistency.sh` auto-detects the Docker E2E app database from `tracking-e2e-storage`. Set `POSTGRES_DB` explicitly only when you target a different database.
`ingestion-load.js` now generates trajectory-based telemetry from absolute `event_time`, so the same `icao` remains kinematically consistent across separate `warmup/ramp/sustained/peak` runs.

Example:
```bash
PUBLIC_BASE_URL=http://localhost:18080 perf/scripts/provision-multi-source-api-keys.sh
PUBLIC_BASE_URL=http://localhost:18080 PROMETHEUS_BASE_URL=http://localhost:9090 \
  perf/scripts/run-multi-source-load.sh warmup
perf/scripts/generate-multi-source-report.sh perf/reports/<run-id>
SOURCE_ID=RADAR-HN perf/scripts/verify-storage-consistency.sh duplicates
perf/scripts/assemble-multi-source-bundle.sh perf/reports/<bundle-id> perf/reports/<warmup-run> perf/reports/<ramp-run> perf/reports/<sustained-run> perf/reports/<peak-run>
```

## Files to keep
- `ingestion-load-summary.json`: output thô từ k6.
- `ingestion-load-notes.md`: bối cảnh chạy test, cấu hình hạ tầng, commit SHA, bottleneck quan sát được.
- `soak-test-summary.md`: kết quả soak 24h, slope heap, GC pause, failure windows.
- `manifest.tsv`: phase/source configuration thực tế đã chạy.
- `*-prometheus.ndjson`: snapshot Prometheus trong lúc chạy multi-source.
- `report.md`: tổng hợp throughput, latency, expected-status rate và error taxonomy theo source.
- `artifacts/`: heap dump, flame graph, `jcmd` output nếu có điều tra memory/CPU.

## Minimum report template
1. Test window: ngày giờ bắt đầu/kết thúc, môi trường, số replicas từng service.
2. Throughput: request/s, record/s, percent đạt so với mục tiêu.
3. Latency: p50/p95/p99 cho `/api/v1/ingest/adsb/batch`.
4. Error taxonomy: `400/401/429/503/5xx`.
5. Kafka signals: publish latency, producer timeout count, lag theo topic.
6. DB signals: storage batch latency, buffer size, batch failure count.
7. Conclusion: pass/fail theo acceptance criteria trong `PLAN.md`.

## Sample report skeleton
```md
# Ingestion Load Report

- Commit: `abcdef1`
- Date: `2026-02-28 14:00 UTC`
- Environment: `local-docker`
- Topology:
  - gateway: 1
  - ingestion: 1
  - processing: 1
  - storage: 1
  - broadcaster: 1
- Command:
  - `REQUEST_RATE=100 BATCH_SIZE=1000 DURATION=10m k6 run --summary-export perf/reports/ingestion-load-summary.json perf/k6/ingestion-load.js`

## Results
- Throughput:
  - requests/s: `100`
  - records/s: `100000`
  - success rate: `99.6%`
- Latency:
  - p50: `82ms`
  - p95: `210ms`
  - p99: `440ms`
- Errors:
  - 400: `0`
  - 401: `0`
  - 429: `14`
  - 503: `0`

## Infra Signals
- ingestion producer unavailable: `0`
- processing DLQ rate: `0.02 msg/s`
- storage buffer max: `1240`
- storage batch p95: `110ms`

## Verdict
- Result: `PASS`
- Bottleneck: `gateway rate limiting did not trigger under target load`
- Follow-up:
  - `none`
```

## Naming convention
- Load run: `perf/reports/ingestion-load-YYYYMMDD-HHMM.md`
- Soak run: `perf/reports/soak-YYYYMMDD-HHMM.md`
- Attach raw JSON summary cùng timestamp tương ứng để đối chiếu.
