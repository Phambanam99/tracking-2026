# Multi-Source Load Test Report

- Date: `2026-03-01T13:55:23+07:00`
- Commit: `a591841`
- Environment: `docker-e2e`
- Run dir: `perf/reports/multi-source-postfix-ramp`

## Per-Phase Results

| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | 2xx | 4xx | 5xx | 400 | 401 | 413 | 429 | 503 | Dropped iterations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ramp | RADAR-HN | 10000 | 10651 | 100.00% | 8.20 | 58.84 | 3001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-HCM | 15000 | 15974 | 100.00% | 6.98 | 49.57 | 4501 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-DN | 10000 | 10647 | 100.00% | 7.12 | 47.74 | 3000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-HP | 20000 | 21295 | 100.00% | 7.32 | 33.37 | 6000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-CT | 15000 | 15971 | 100.00% | 8.10 | 49.99 | 4500 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Pipeline Metrics Snapshot

| Metric | Latest value |
|---|---|
| ingestion records rate | 0 |
| ingestion publish rate | 0 |
| ingestion admission reject rate | 0 |
| processing pipeline p95 | 0.0009500464467151728 |
| processing DLQ rate | 0 |
| ingestion publish failed rate | n/a |
| storage batch p95 | 0.9755951077656251 |
| storage buffer size | 5000 |
| storage batch failures (5m) | 0 |
| ws sessions active | 0 |
| ws push p95 | NaN |
| firing alerts | 1 |

## Verdict

- PASS / FAIL: PASS - expected-status avg 100.00%, total 2xx=21002, 4xx=0, 5xx=0, max p95=8.20ms
- Bottleneck: No throughput bottleneck observed; review 1 firing alert(s) separately
- Follow-up: Inspect active Prometheus alert(s) and tune alert hygiene if they are unrelated to load acceptance
