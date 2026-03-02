# Multi-Source Load Test Report

- Date: `2026-03-01T14:50:08+07:00`
- Commit: `a591841`
- Environment: `docker-e2e`
- Run dir: `perf/reports/local-ci-smoke-check-bundle`

## Per-Phase Results

| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | 2xx | 4xx | 5xx | 400 | 401 | 413 | 429 | 503 | Dropped iterations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| warmup | RADAR-HN | 400 | 427 | 100.00% | 27.63 | 633.41 | 41 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Pipeline Metrics Snapshot

| Metric | Latest value |
|---|---|
| ingestion records rate | 133.26573722010986 |
| ingestion publish rate | 133.33333333333334 |
| ingestion admission reject rate | 0 |
| processing pipeline p95 | NaN |
| processing DLQ rate | 0 |
| ingestion publish failed rate | 0 |
| storage batch p95 | 1.8526987941999995 |
| storage buffer size | 0 |
| storage batch failures (5m) | 0 |
| ws sessions active | 0 |
| ws push p95 | NaN |
| firing alerts | 0 |

## Verdict

- PASS / FAIL: PASS - expected-status avg 100.00%, total 2xx=41, 4xx=0, 5xx=0, max p95=27.63ms
- Bottleneck: No material bottleneck observed in this run
- Follow-up: Promote this bundle as the new performance baseline and keep rerunning after each throughput-sensitive change
