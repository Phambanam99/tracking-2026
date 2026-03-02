# Multi-Source Load Test Report

- Date: `2026-03-01T15:08:42+07:00`
- Commit: `a591841`
- Environment: `docker-e2e`
- Run dir: `perf/reports/multi-source-ci-patched-bundle-20260301-150842`

## Per-Phase Results

| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | 2xx | 4xx | 5xx | 400 | 401 | 413 | 429 | 503 | Dropped iterations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| warmup | RADAR-HN | 10000 | 10638 | 100.00% | 14.70 | 48.39 | 1201 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-HN | 10000 | 10617 | 100.00% | 10.23 | 133.33 | 3001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-HCM | 15000 | 15924 | 100.00% | 9.73 | 169.27 | 4501 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-DN | 10000 | 10617 | 100.00% | 9.29 | 155.24 | 3001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-HP | 20000 | 21230 | 100.00% | 9.84 | 131.33 | 6001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-CT | 15000 | 15924 | 100.00% | 10.05 | 163.98 | 4501 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-HN | 10000 | 10638 | 100.00% | 9.04 | 204.56 | 6001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-HCM | 15000 | 15955 | 100.00% | 8.52 | 194.53 | 9000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-DN | 10000 | 10637 | 100.00% | 7.63 | 157.60 | 6000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-HP | 20000 | 21275 | 100.00% | 8.41 | 204.52 | 12001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-CT | 15000 | 15957 | 100.00% | 8.38 | 198.91 | 9001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
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

- PASS / FAIL: PASS - expected-status avg 100.00%, total 2xx=76213, 4xx=0, 5xx=0, max p95=14.70ms
- Bottleneck: No material bottleneck observed in this run
- Follow-up: Promote this bundle as the new performance baseline and keep rerunning after each throughput-sensitive change
