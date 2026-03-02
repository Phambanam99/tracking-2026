# Multi-Source Load Test Report

- Date: `2026-03-01T14:20:22+07:00`
- Commit: `a591841`
- Environment: `docker-e2e`
- Run dir: `perf/reports/multi-source-final-bundle-20260301-142022`

## Per-Phase Results

| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | 2xx | 4xx | 5xx | 400 | 401 | 413 | 429 | 503 | Dropped iterations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| warmup | RADAR-HN | 10000 | 10677 | 100.00% | 7.30 | 12.74 | 1201 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-HN | 10000 | 10675 | 100.00% | 9.22 | 153.67 | 3001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-HCM | 15000 | 16011 | 100.00% | 8.09 | 159.01 | 4501 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-DN | 10000 | 10675 | 100.00% | 8.10 | 167.80 | 3001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-HP | 20000 | 21347 | 100.00% | 7.54 | 151.84 | 6001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ramp | RADAR-CT | 15000 | 16011 | 100.00% | 8.37 | 155.58 | 4501 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-HN | 10000 | 10667 | 100.00% | 7.74 | 98.12 | 6001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-HCM | 15000 | 16000 | 100.00% | 7.69 | 87.28 | 9001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-DN | 10000 | 10667 | 100.00% | 7.41 | 122.23 | 6001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-HP | 20000 | 21333 | 100.00% | 7.97 | 96.89 | 12001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sustained | RADAR-CT | 15000 | 15999 | 100.00% | 7.58 | 140.81 | 9000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
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

- PASS / FAIL: PASS - expected-status avg 100.00%, total 2xx=76213, 4xx=0, 5xx=0, max p95=9.22ms
- Bottleneck: No material bottleneck observed in this run
- Follow-up: Promote this bundle as the new performance baseline and keep rerunning after each throughput-sensitive change
