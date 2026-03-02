# Multi-Source Load Test Report

- Date: `2026-03-01T14:08:58+07:00`
- Commit: `a591841`
- Environment: `docker-e2e`
- Run dir: `perf/reports/multi-source-final-ramp`

## Per-Phase Results

| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | 2xx | 4xx | 5xx | 400 | 401 | 413 | 429 | 503 | Dropped iterations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ramp | RADAR-HN | 10000 | 10675 | 100.00% | 9.22 | 153.67 | 3001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-HCM | 15000 | 16011 | 100.00% | 8.09 | 159.01 | 4501 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-DN | 10000 | 10675 | 100.00% | 8.10 | 167.80 | 3001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-HP | 20000 | 21347 | 100.00% | 7.54 | 151.84 | 6001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-CT | 15000 | 16011 | 100.00% | 8.37 | 155.58 | 4501 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Pipeline Metrics Snapshot

| Metric | Latest value |
|---|---|
| ingestion records rate | 76430.33920512447 |
| ingestion publish rate | 76430.33920512447 |
| ingestion admission reject rate | 0 |
| processing pipeline p95 | 0.000950105632511718 |
| processing DLQ rate | 0 |
| ingestion publish failed rate | 0 |
| storage batch p95 | 1.2556814106749996 |
| storage buffer size | 5000 |
| storage batch failures (5m) | 0 |
| ws sessions active | 0 |
| ws push p95 | NaN |
| firing alerts | 0 |

## Verdict

- PASS / FAIL: PASS - expected-status avg 100.00%, total 2xx=21005, 4xx=0, 5xx=0, max p95=9.22ms
- Bottleneck: No material bottleneck observed in this run
- Follow-up: Promote this bundle as the new performance baseline and keep rerunning after each throughput-sensitive change
