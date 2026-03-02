# Multi-Source Load Test Report

- Date: `2026-03-01T13:55:24+07:00`
- Commit: `a591841`
- Environment: `docker-e2e`
- Run dir: `perf/reports/multi-source-postfix-peak`

## Per-Phase Results

| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | 2xx | 4xx | 5xx | 400 | 401 | 413 | 429 | 503 | Dropped iterations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| peak | RADAR-HN | 20000 | 21325 | 100.00% | 7.63 | 43.22 | 2401 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| peak | RADAR-HCM | 20000 | 21318 | 100.00% | 7.56 | 38.87 | 2400 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| peak | RADAR-DN | 20000 | 21318 | 100.00% | 6.91 | 49.15 | 2400 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| peak | RADAR-HP | 20000 | 21324 | 100.00% | 7.03 | 44.29 | 2401 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| peak | RADAR-CT | 20000 | 21325 | 100.00% | 8.22 | 26.76 | 2401 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Pipeline Metrics Snapshot

| Metric | Latest value |
|---|---|
| ingestion records rate | 0 |
| ingestion publish rate | 0 |
| ingestion admission reject rate | 0 |
| processing pipeline p95 | 0.0009500443347816029 |
| processing DLQ rate | 0 |
| ingestion publish failed rate | n/a |
| storage batch p95 | 1.2598570733199999 |
| storage buffer size | 5000 |
| storage batch failures (5m) | 0 |
| ws sessions active | 0 |
| ws push p95 | NaN |
| firing alerts | 1 |

## Verdict

- PASS / FAIL: PASS - expected-status avg 100.00%, total 2xx=12003, 4xx=0, 5xx=0, max p95=8.22ms
- Bottleneck: No throughput bottleneck observed; review 1 firing alert(s) separately
- Follow-up: Inspect active Prometheus alert(s) and tune alert hygiene if they are unrelated to load acceptance
