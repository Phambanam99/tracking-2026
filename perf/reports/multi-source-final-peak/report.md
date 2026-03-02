# Multi-Source Load Test Report

- Date: `2026-03-01T14:20:21+07:00`
- Commit: `a591841`
- Environment: `docker-e2e`
- Run dir: `perf/reports/multi-source-final-peak`

## Per-Phase Results

| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | 2xx | 4xx | 5xx | 400 | 401 | 413 | 429 | 503 | Dropped iterations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| peak | RADAR-HN | 20000 | 21323 | 100.00% | 8.03 | 56.69 | 2401 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| peak | RADAR-HCM | 20000 | 21317 | 100.00% | 8.78 | 61.91 | 2400 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| peak | RADAR-DN | 20000 | 21323 | 100.00% | 8.84 | 49.52 | 2401 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| peak | RADAR-HP | 20000 | 21323 | 100.00% | 9.04 | 46.11 | 2401 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| peak | RADAR-CT | 20000 | 21317 | 100.00% | 8.83 | 64.74 | 2400 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Pipeline Metrics Snapshot

| Metric | Latest value |
|---|---|
| ingestion records rate | 106609.80810234543 |
| ingestion publish rate | 106609.80810234543 |
| ingestion admission reject rate | 0 |
| processing pipeline p95 | 0.0009500937425826015 |
| processing DLQ rate | 3905.3434053202336 |
| ingestion publish failed rate | 0 |
| storage batch p95 | 1.40108394920625 |
| storage buffer size | 5000 |
| storage batch failures (5m) | 0 |
| ws sessions active | 0 |
| ws push p95 | NaN |
| firing alerts | 0 |

## Verdict

- PASS / FAIL: PASS - expected-status avg 100.00%, total 2xx=12003, 4xx=0, 5xx=0, max p95=9.04ms
- Bottleneck: No material bottleneck observed in this run
- Follow-up: Promote this bundle as the new performance baseline and keep rerunning after each throughput-sensitive change
