# Multi-Source Load Test Report

- Date: `2026-03-01T11:10:39+07:00`
- Commit: `a591841`
- Environment: `docker-e2e`
- Run dir: `perf/reports/multi-source-revoke5`

## Per-Phase Results

| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | 2xx | 4xx | 5xx | 400 | 401 | 413 | 429 | 503 | Dropped iterations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| warmup | RADAR-HN | 1000 | 1288 | 100.00% | 114.65 | 118.11 | 2 | 6 | 0 | 0 | 6 | 0 | 0 | 0 | 0 |

## Pipeline Metrics Snapshot

| Metric | Latest value |
|---|---|
| ingestion records rate | 568.8956313556308 |
| ingestion publish rate | 568.8956313556308 |
| ingestion admission reject rate | 0 |
| processing pipeline p95 | 0.0009541601382025631 |
| processing DLQ rate | 0 |
| storage batch p95 | 0.00860081875892857 |
| storage buffer size | 0 |
| storage batch failures (5m) | 0 |
| ws sessions active | 0 |
| ws push p95 | NaN |
| firing alerts | 0 |

## Verdict

- PASS / FAIL:
- Bottleneck:
- Follow-up:
