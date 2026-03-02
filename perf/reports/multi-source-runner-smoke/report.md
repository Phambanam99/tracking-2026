# Multi-Source Load Test Report

- Date: `2026-03-01T13:54:55+07:00`
- Commit: `a591841`
- Environment: `docker-e2e`
- Run dir: `perf/reports/multi-source-runner-smoke`

## Per-Phase Results

| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | 2xx | 4xx | 5xx | 400 | 401 | 413 | 429 | 503 | Dropped iterations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| warmup | RADAR-HN | 1 | 1 | 100.00% | 12.34 | 15.33 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Pipeline Metrics Snapshot

| Metric | Latest value |
|---|---|
| ingestion records rate | 0 |
| ingestion publish rate | 0 |
| ingestion admission reject rate | 0 |
| processing pipeline p95 | NaN |
| processing DLQ rate | 0 |
| ingestion publish failed rate | 0 |
| storage batch p95 | 1.2670153521399998 |
| storage buffer size | 5000 |
| storage batch failures (5m) | 0 |
| ws sessions active | 0 |
| ws push p95 | NaN |
| firing alerts | 1 |

## Verdict

- PASS / FAIL: PASS - expected-status avg 100.00%, total 2xx=6, 4xx=0, 5xx=0, max p95=12.34ms
- Bottleneck: No throughput bottleneck observed; review 1 firing alert(s) separately
- Follow-up: Inspect active Prometheus alert(s) and tune alert hygiene if they are unrelated to load acceptance
