# Multi-Source Load Test Report

- Date: `2026-03-01T15:06:43+07:00`
- Commit: `a591841`
- Environment: `docker-e2e`
- Run dir: `perf/reports/multi-source-ci-patched-sustained`

## Per-Phase Results

| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | 2xx | 4xx | 5xx | 400 | 401 | 413 | 429 | 503 | Dropped iterations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| sustained | RADAR-HN | 10000 | 10638 | 100.00% | 9.04 | 204.56 | 6001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-HCM | 15000 | 15955 | 100.00% | 8.52 | 194.53 | 9000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-DN | 10000 | 10637 | 100.00% | 7.63 | 157.60 | 6000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-HP | 20000 | 21275 | 100.00% | 8.41 | 204.52 | 12001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-CT | 15000 | 15957 | 100.00% | 8.38 | 198.91 | 9001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Pipeline Metrics Snapshot

| Metric | Latest value |
|---|---|
| ingestion records rate | 73725.60033703131 |
| ingestion publish rate | 73733.23035154238 |
| ingestion admission reject rate | 0 |
| processing pipeline p95 | 0.0009500791732644388 |
| processing DLQ rate | 0 |
| ingestion publish failed rate | 0 |
| storage batch p95 | 1.0600469138285715 |
| storage buffer size | 5000 |
| storage batch failures (5m) | 0 |
| ws sessions active | 0 |
| ws push p95 | NaN |
| firing alerts | 0 |

## Verdict

- PASS / FAIL: PASS - expected-status avg 100.00%, total 2xx=42003, 4xx=0, 5xx=0, max p95=9.04ms
- Bottleneck: No material bottleneck observed in this run
- Follow-up: Promote this bundle as the new performance baseline and keep rerunning after each throughput-sensitive change
