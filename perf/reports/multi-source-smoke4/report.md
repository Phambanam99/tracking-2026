# Multi-Source Load Test Report

- Date: `2026-03-01T11:03:47+07:00`
- Commit: `a591841`
- Environment: `docker-e2e`
- Run dir: `perf/reports/multi-source-smoke4`

## Per-Phase Results

| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | Dropped iterations |
|---|---|---|---|---|---|---|---|
| warmup | RADAR-HN | 1000 | 1171 | 100.00% | 135.01 | 139.86 | 0 |

## Pipeline Metrics Snapshot

| Metric | Latest value |
|---|---|
| ingestion records rate | 0 |
| ingestion publish rate | 0 |
| ingestion admission reject rate | 0 |
| processing pipeline p95 | NaN |
| processing DLQ rate | 0 |
| storage batch p95 | 0.008598322149999995 |
| storage buffer size | 0 |
| storage batch failures (5m) | 0 |
| ws sessions active | 0 |
| ws push p95 | NaN |
| firing alerts | 0 |

## Verdict

- PASS / FAIL:
- Bottleneck:
- Follow-up:
