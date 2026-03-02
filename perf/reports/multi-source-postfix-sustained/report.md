# Multi-Source Load Test Report

- Date: `2026-03-01T13:55:23+07:00`
- Commit: `a591841`
- Environment: `docker-e2e`
- Run dir: `perf/reports/multi-source-postfix-sustained`

## Per-Phase Results

| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | 2xx | 4xx | 5xx | 400 | 401 | 413 | 429 | 503 | Dropped iterations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| sustained | RADAR-HN | 10000 | 10648 | 100.00% | 6.87 | 80.50 | 6001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-HCM | 15000 | 15971 | 100.00% | 6.89 | 85.99 | 9001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-DN | 10000 | 10646 | 100.00% | 7.05 | 121.37 | 6000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-HP | 20000 | 21293 | 100.00% | 7.24 | 144.23 | 12001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-CT | 15000 | 15969 | 100.00% | 6.92 | 93.87 | 9000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Pipeline Metrics Snapshot

| Metric | Latest value |
|---|---|
| ingestion records rate | 18697.001992493395 |
| ingestion publish rate | 18686.159121449422 |
| ingestion admission reject rate | 0 |
| processing pipeline p95 | 0.0009500832321140558 |
| processing DLQ rate | 800.1575386896487 |
| ingestion publish failed rate | n/a |
| storage batch p95 | 0.98258561440625 |
| storage buffer size | 5000 |
| storage batch failures (5m) | 0 |
| ws sessions active | 0 |
| ws push p95 | NaN |
| firing alerts | 1 |

## Verdict

- PASS / FAIL: PASS - expected-status avg 100.00%, total 2xx=42003, 4xx=0, 5xx=0, max p95=7.24ms
- Bottleneck: No throughput bottleneck observed; review 1 firing alert(s) separately
- Follow-up: Inspect active Prometheus alert(s) and tune alert hygiene if they are unrelated to load acceptance
