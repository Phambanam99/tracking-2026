# Multi-Source Load Test Report

- Date: `2026-03-01T14:42:12+07:00`
- Commit: `a591841`
- Environment: `docker-e2e`
- Run dir: `perf/reports/multi-source-clean-sustained`

## Per-Phase Results

| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | 2xx | 4xx | 5xx | 400 | 401 | 413 | 429 | 503 | Dropped iterations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| sustained | RADAR-HN | 10000 | 10665 | 100.00% | 9.01 | 171.32 | 6001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-HCM | 15000 | 15997 | 100.00% | 8.63 | 164.08 | 9001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-DN | 10000 | 10665 | 100.00% | 8.68 | 151.59 | 6001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-HP | 20000 | 21329 | 100.00% | 8.70 | 184.91 | 12001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-CT | 15000 | 15997 | 100.00% | 8.60 | 166.30 | 9001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Pipeline Metrics Snapshot

| Metric | Latest value |
|---|---|
| ingestion records rate | 76395.12041326122 |
| ingestion publish rate | 76370.86799408242 |
| ingestion admission reject rate | 0 |
| processing pipeline p95 | 0.0009500871667273602 |
| processing DLQ rate | 0 |
| ingestion publish failed rate | 0 |
| storage batch p95 | 1.8807561667333332 |
| storage buffer size | 5000 |
| storage batch failures (5m) | 0 |
| ws sessions active | 0 |
| ws push p95 | NaN |
| firing alerts | 0 |

## Verdict

- PASS / FAIL: PASS - expected-status avg 100.00%, total 2xx=42005, 4xx=0, 5xx=0, max p95=9.01ms
- Bottleneck: No material bottleneck observed in this run
- Follow-up: Promote this bundle as the new performance baseline and keep rerunning after each throughput-sensitive change
