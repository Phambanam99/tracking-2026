# Multi-Source Load Test Report

- Date: `2026-03-01T14:18:24+07:00`
- Commit: `a591841`
- Environment: `docker-e2e`
- Run dir: `perf/reports/multi-source-final-sustained`

## Per-Phase Results

| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | 2xx | 4xx | 5xx | 400 | 401 | 413 | 429 | 503 | Dropped iterations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| sustained | RADAR-HN | 10000 | 10667 | 100.00% | 7.74 | 98.12 | 6001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-HCM | 15000 | 16000 | 100.00% | 7.69 | 87.28 | 9001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-DN | 10000 | 10667 | 100.00% | 7.41 | 122.23 | 6001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-HP | 20000 | 21333 | 100.00% | 7.97 | 96.89 | 12001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-CT | 15000 | 15999 | 100.00% | 7.58 | 140.81 | 9000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Pipeline Metrics Snapshot

| Metric | Latest value |
|---|---|
| ingestion records rate | 73427.8571303694 |
| ingestion publish rate | 73427.8571303694 |
| ingestion admission reject rate | 0 |
| processing pipeline p95 | 0.0009500989309363005 |
| processing DLQ rate | 0 |
| ingestion publish failed rate | 0 |
| storage batch p95 | 1.23480309745 |
| storage buffer size | 5000 |
| storage batch failures (5m) | 0 |
| ws sessions active | 0 |
| ws push p95 | NaN |
| firing alerts | 0 |

## Verdict

- PASS / FAIL: PASS - expected-status avg 100.00%, total 2xx=42004, 4xx=0, 5xx=0, max p95=7.97ms
- Bottleneck: No material bottleneck observed in this run
- Follow-up: Promote this bundle as the new performance baseline and keep rerunning after each throughput-sensitive change
