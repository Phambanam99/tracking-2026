# Tech Lead Review: P10 – Release Readiness (Final)

**Date:** 2026-03-01  
**Files reviewed:** 25+ files across 5 REL tasks + Helm chart + cross-module checklist  
**Verdict:** ✅ **PASS – 9.3/10 – Production-Ready**

---

## Bảng Điểm

| Task | Before | After | Điểm |
|---|---|---|---|
| REL-01 Runbook | 62 LOC, decent | 210 LOC, đầy đủ | **9.5/10** |
| REL-01 Incident Response | 13 LOC, skeleton | 93 LOC, 5 playbooks | **9/10** |
| REL-02 Backup/Restore | 12 LOC, skeleton | 91 LOC, prod-grade | **9/10** |
| REL-03 Threat Model | 14 LOC, skeleton | 72 LOC + 21 LOC abuse-cases | **9.5/10** |
| REL-04 Helm Hardening | — (mới) | values 237 LOC, prod 118 LOC, PDB + HPA | **9/10** |
| REL-05 Cross-module Verify | — (mới) | 87 LOC, 29/29 PASS | **9.5/10** |

---

## REL-01: Runbook + Incident Response ✅ 9.5/10

### `docs/runbook.md` (210 LOC)

| Section | Nội dung |
|---|---|
| Startup order | DB → Kafka → Auth → Pipeline → Gateway → Frontend ✅ |
| Health verification | 6 service health curls + JWKS endpoint ✅ |
| Smoke flow | Register → Login → API key → Ingest → Verify topics + WS ✅ |
| Logs & observability | Docker logs, K8s logs, dashboard links, **metrics cheat sheet 5 services** ✅ |
| Rollback | Helm rollback + Docker image rollback ✅ |
| Troubleshooting | **6 service playbooks**: Auth, Gateway, Ingestion, Processing, Storage, Broadcaster ✅ |
| Common incidents | Kafka backlog, WS push chậm, rolling update procedure ✅ |

### `docs/incident-response.md` (93 LOC)

| Section | Đánh giá |
|---|---|
| Severity matrix (SEV-1/2/3) + response targets | ✅ Có owner + SLA |
| Escalation matrix | ✅ Channel mapping (#war-room, #ops) |
| 7-step standard process | ✅ Declare → Freeze → Blast radius → Mitigate → Preserve → Update → Postmortem |
| 5 service playbooks | ✅ Kafka, PostgreSQL, Auth/JWKS, Gateway, Broadcaster |
| Communication template | ✅ Status/Severity/Impact/Scope/Mitigation |
| Postmortem template | ✅ Root cause + corrective actions with owner/due |

---

## REL-02: Backup/Restore ✅ 9/10

`infra/postgres/backup-restore.md` (91 LOC)

| Feature | Đánh giá |
|---|---|
| Backup strategy (logical + WAL archiving) | ✅ pgBackRest/WAL-G recommended |
| Retention policy | ✅ Daily 14d, weekly 8w, monthly 6m, WAL 7d |
| Restore drill | ✅ Script path + 5 SQL validation steps |
| Timescale-specific | ✅ Verify extension + hypertable + indexes |
| Monitoring/alerts | ✅ Backup age > 26h, WAL fail > 15m, drill > 30d |
| DR notes | ✅ Off-cluster copy, isolated restore DB |

---

## REL-03: Threat Model + Abuse Cases ✅ 9.5/10

### `docs/threat-model.md` (72 LOC)

| Feature | Đánh giá |
|---|---|
| System context + trust boundaries (4 layers) | ✅ |
| Mermaid data flow diagram | ✅ Full pipeline visualized |
| **STRIDE analysis: 10 threats** with L×I scoring | ✅ Scores range 8-20 |
| Attack-to-control mapping (8 vectors) | ✅ Maps to implemented controls |
| Residual risks (3 items) | ✅ Honest: payload signing, Kafka ACL, secret manager |

### `docs/abuse-cases.md` (21 LOC)

8 abuse scenarios with entry point → control → detection mapping. Response principles documented.

---

## REL-04: Helm Hardening ✅ 9/10

### `values.yaml` (124 → 237 LOC)

| Feature | Before | After |
|---|---|---|
| `startupProbe` | ❌ | ✅ `failureThreshold: 30` → 5min warm-up budget |
| `resources` | `{}` empty | ✅ All 6 services have requests + limits |
| PDB scaffolding | ❌ | ✅ `pdb.enabled`, `maxUnavailable: 1` |
| HPA scaffolding | ❌ | ✅ CPU 70% + Memory 80% targets |
| `SERVER_PORT` env | ❌ | ✅ Explicit port per service |

### Resource Allocation

| Service | Requests | Limits | HPA max (prod) |
|---|---|---|---|
| Gateway | 200m / 256Mi | 1 / 512Mi | 8 pods |
| Auth | 250m / 256Mi | 1 / 512Mi | 6 pods |
| Ingestion | 500m / 512Mi | 2 / 1Gi | 12 pods |
| Processing | 500m / 512Mi | 2 / 1Gi | 12 pods |
| Storage | 500m / 512Mi | 2 / 1Gi | 8 pods |
| Broadcaster | 300m / 384Mi | 1 / 768Mi | 10 pods |

### Prod values (28 → 118 LOC)
- All PDBs enabled ✅
- All HPAs enabled, CPU target 65%, memory 75% ✅
- Ingestion/Processing upgraded: req 1 CPU / 1Gi, limits 4 CPU / 2Gi ✅
- Broadcaster: req 500m / 768Mi, limits 2 / 1.5Gi ✅

### New templates
- `pdb.yaml` (25 LOC) – Loop all 6 components, `minAvailable` or `maxUnavailable` ✅
- `hpa.yaml` (35 LOC) – `autoscaling/v2`, CPU + memory metrics ✅

---

## REL-05: Acceptance Verification ✅ 9.5/10

`docs/acceptance-verification.md` (87 LOC) – **29/29 cross-module items PASS**

| Category | Evidence quality |
|---|---|
| Commands executed | ✅ Full Gradle test, Helm lint/template, Docker compose, E2E script |
| Runtime matrix (10 flows) | ✅ P0 infra → P7 WS push, observability stack |
| Cross-module evidence (29 items) | ✅ **Mỗi item có file-level evidence** (source + test paths) |
| Residual notes | ✅ Honest: local gate, chưa cluster deployment proof |

---

## Điểm Nổi Bật Toàn P10

1. **Runbook 210 LOC là production-grade** – startup order, rollback, 6 service troubleshooters, metrics cheat sheet
2. **Incident response có 5 service-specific playbooks** – Kafka, Postgres, Auth, Gateway, Broadcaster → trực chiến được ngay
3. **STRIDE threat model với risk scoring** – 10 threats scored L×I, 3 residual risks acknowledged
4. **Helm chart hardened** – startupProbe 5min budget, resource limits, PDB+HPA, prod overrides riêng
5. **Acceptance verification 29/29 PASS** – mỗi checklist item có file-level evidence, reproducible commands

## Nitpick nhỏ (không block)

1. `pdb.enabled: false` ở base values – OK cho dev, nhưng stg nên enable nếu dùng shared cluster
2. Ingestion HPA max 12 pods – với 100k msg/s nên stress test xem 12 pods đủ chưa
3. `abuse-cases.md` 21 LOC – compact, có thể thêm DoS on WS connect và brute-force API key guess
