# Multi-Source Load Test Report

- Date: `2026-03-01T15:08:41+07:00`
- Commit: `a591841`
- Environment: `docker-e2e`
- Run dir: `perf/reports/multi-source-ci-patched-peak`

## Per-Phase Results

| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | 2xx | 4xx | 5xx | 400 | 401 | 413 | 429 | 503 | Dropped iterations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| peak | RADAR-HN | 20000 | 21279 | 100.00% | 10.51 | 102.60 | 2401 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| peak | RADAR-HCM | 20000 | 21279 | 100.00% | 10.43 | 94.74 | 2401 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| peak | RADAR-DN | 20000 | 21281 | 100.00% | 10.13 | 73.73 | 2401 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| peak | RADAR-HP | 20000 | 21278 | 100.00% | 10.82 | 74.47 | 2400 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| peak | RADAR-CT | 20000 | 21282 | 100.00% | 9.99 | 99.55 | 2401 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Pipeline Metrics Snapshot

| Metric | Latest value |
|---|---|
| ingestion records rate | 108706.15518407576 |
| ingestion publish rate | 108695.01884240023 |
| ingestion admission reject rate | 0 |
| processing pipeline p95 | 0.0009500878735207957 |
| processing DLQ rate | 0 |
| ingestion publish failed rate | 0 |
| storage batch p95 | 1.4070491815562498 |
| storage buffer size | 5000 |
| storage batch failures (5m) | 0 |
| ws sessions active | 0 |
| ws push p95 | NaN |
| firing alerts | 0 |

## Verdict

- PASS / FAIL: PASS - expected-status avg 100.00%, total 2xx=12004, 4xx=0, 5xx=0, max p95=10.82ms
- Bottleneck: No material bottleneck observed in this run
- Follow-up: Promote this bundle as the new performance baseline and keep rerunning after each throughput-sensitive change
