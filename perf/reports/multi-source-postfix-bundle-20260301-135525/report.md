# Multi-Source Load Test Report

- Date: `2026-03-01T13:55:25+07:00`
- Commit: `a591841`
- Environment: `docker-e2e`
- Run dir: `perf/reports/multi-source-postfix-bundle-20260301-135525`

## Per-Phase Results

| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | 2xx | 4xx | 5xx | 400 | 401 | 413 | 429 | 503 | Dropped iterations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| warmup | RADAR-HN | 10000 | 10659 | 100.00% | 17.26 | 661.67 | 1201 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-HN | 10000 | 10651 | 100.00% | 8.20 | 58.84 | 3001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-HCM | 15000 | 15974 | 100.00% | 6.98 | 49.57 | 4501 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-DN | 10000 | 10647 | 100.00% | 7.12 | 47.74 | 3000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-HP | 20000 | 21295 | 100.00% | 7.32 | 33.37 | 6000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-CT | 15000 | 15971 | 100.00% | 8.10 | 49.99 | 4500 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-HN | 10000 | 10648 | 100.00% | 6.87 | 80.50 | 6001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-HCM | 15000 | 15971 | 100.00% | 6.89 | 85.99 | 9001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-DN | 10000 | 10646 | 100.00% | 7.05 | 121.37 | 6000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-HP | 20000 | 21293 | 100.00% | 7.24 | 144.23 | 12001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-CT | 15000 | 15969 | 100.00% | 6.92 | 93.87 | 9000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
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

- PASS / FAIL: PASS - expected-status avg 100.00%, total 2xx=76209, 4xx=0, 5xx=0, max p95=17.26ms
- Bottleneck: No throughput bottleneck observed; review 1 firing alert(s) separately
- Follow-up: Inspect active Prometheus alert(s) and tune alert hygiene if they are unrelated to load acceptance
