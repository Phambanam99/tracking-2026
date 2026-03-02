# Multi-Source Load Test Report

- Date: `2026-03-01T13:12:09+07:00`
- Commit: `a591841`
- Environment: `docker-e2e`
- Run dir: `perf/reports/multi-source-full-20260301-130252`

## Per-Phase Results

| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | 2xx | 4xx | 5xx | 400 | 401 | 413 | 429 | 503 | Dropped iterations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| warmup | RADAR-HN | 10000 | 10731 | 99.50% | 114.41 | 1153.06 | 1194 | 0 | 6 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-HN | 10000 | 10636 | 95.77% | 398.07 | 1006.52 | 2874 | 0 | 127 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-HCM | 15000 | 15952 | 95.76% | 385.75 | 1009.81 | 4310 | 0 | 191 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-DN | 10000 | 10636 | 95.73% | 396.17 | 1008.28 | 2873 | 0 | 128 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-HP | 20000 | 21268 | 95.75% | 394.13 | 1013.42 | 5745 | 0 | 255 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-CT | 15000 | 15952 | 95.78% | 383.99 | 1013.18 | 4311 | 0 | 190 | 0 | 0 | 0 | 0 | 0 | 0 |

## Pipeline Metrics Snapshot

| Metric | Latest value |
|---|---|
| ingestion records rate | 70844.49782869813 |
| ingestion publish rate | 71207.52102004988 |
| ingestion admission reject rate | 0 |
| processing pipeline p95 | 0.0009558952042755174 |
| processing DLQ rate | 246.91044327920355 |
| storage batch p95 | 0.007675207568684209 |
| storage buffer size | 15 |
| storage batch failures (5m) | 0 |
| ws sessions active | 0 |
| ws push p95 | NaN |
| firing alerts | 0 |

## Verdict

- PASS / FAIL:
- Bottleneck:
- Follow-up:
