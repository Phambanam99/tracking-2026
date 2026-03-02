# Multi-Source Load Test Report

- Date: `2026-03-01T13:55:22+07:00`
- Commit: `a591841`
- Environment: `docker-e2e`
- Run dir: `perf/reports/multi-source-postfix-warmup`

## Per-Phase Results

| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | 2xx | 4xx | 5xx | 400 | 401 | 413 | 429 | 503 | Dropped iterations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| warmup | RADAR-HN | 10000 | 10659 | 100.00% | 17.26 | 661.67 | 1201 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Pipeline Metrics Snapshot

| Metric | Latest value |
|---|---|
| ingestion records rate | 0 |
| ingestion publish rate | 0 |
| ingestion admission reject rate | 0 |
| processing pipeline p95 | 0.0009500380015200609 |
| processing DLQ rate | 0 |
| ingestion publish failed rate | n/a |
| storage batch p95 | 0.9735259178 |
| storage buffer size | 5000 |
| storage batch failures (5m) | 0 |
| ws sessions active | 0 |
| ws push p95 | NaN |
| firing alerts | 1 |

## Verdict

- PASS / FAIL: PASS - expected-status avg 100.00%, total 2xx=1201, 4xx=0, 5xx=0, max p95=17.26ms
- Bottleneck: No throughput bottleneck observed; review 1 firing alert(s) separately
- Follow-up: Inspect active Prometheus alert(s) and tune alert hygiene if they are unrelated to load acceptance
