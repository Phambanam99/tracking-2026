# Incident Response

## Severity levels

| Severity | Description | Response target | Owner |
|---|---|---|---|
| `SEV-1` | Mất realtime toàn hệ thống hoặc ingest/storage dừng hoàn toàn | 5 phút | Incident Commander + Tech Lead |
| `SEV-2` | Gián đoạn một phần, degrade rõ rệt theo vùng hoặc service | 15 phút | On-call engineer |
| `SEV-3` | Degrade hiệu năng, lỗi không lan rộng | 1 giờ | Team owning service |

## Escalation matrix

| Trigger | Notify | Channel |
|---|---|---|
| `SEV-1` | Tech lead, backend lead, infra/on-call, product owner | `#tracking-war-room`, phone bridge |
| `SEV-2` | Service owner, infra/on-call, QA lead | `#tracking-ops` |
| `SEV-3` | Service owner | ticket + `#tracking-ops` |

## Standard process
1. Declare severity and assign Incident Commander.
2. Freeze unrelated deploys.
3. Establish blast radius: auth, ingest, processing, storage, broadcaster, frontend.
4. Mitigate or rollback to restore service first.
5. Preserve evidence: logs, metrics snapshots, trace IDs, Kafka offsets.
6. Publish status updates every 15 minutes for `SEV-1`, every 30 minutes for `SEV-2`.
7. Postmortem in 48 hours with clear owner and follow-up tasks.

## Service playbooks

### Kafka unavailable / broker unhealthy
1. Confirm broker health via Docker/Kubernetes and client logs.
2. Check if ingestion is failing fast with `429/503` instead of unbounded buffering.
3. Pause risky deploys.
4. If cluster recovery is slow, scale down inbound load or temporarily block crawler API keys.
5. After recovery, verify lag catches up and no DLQ spike remains.

### PostgreSQL / TimescaleDB unavailable
1. Confirm DB health and disk space.
2. Stop rollout to `service-storage`.
3. Inspect `tracking_storage_batch_failed_total` and quarantine volume.
4. Restore from latest valid backup or PITR if corruption detected.
5. Run storage smoke verification before re-enabling write traffic.

### Auth / JWKS issue
1. Check `/api/v1/auth/.well-known/jwks.json`.
2. Verify signing key table and latest migration state.
3. Confirm gateway/broadcaster JWKS caches refresh successfully.
4. If invalid key rotation caused auth outage, rollback auth or restore previous active key set.

### Gateway auth/rate-limit incident
1. Check `401/403/429/413/5xx` split by route.
2. Validate Redis health and rate-limit policy.
3. Verify request-size policy and route metadata timeouts.
4. If a bad policy deploy caused incident, rollback gateway first.

### Broadcaster / WebSocket outage
1. Check `ws_sessions_active`, `ws_sessions_rejected_jwt_total`, and consumer lag on `live-adsb`.
2. Verify STOMP CONNECT still requires JWT.
3. Validate viewport filtering and session cleanup behavior.
4. If broadcaster is unhealthy, restart/rollback broadcaster only; do not touch ingest/storage blindly.

## Communication template

```md
Status: INVESTIGATING
Severity: SEV-1
Start time: 2026-03-01 10:15 UTC
Impact: Realtime flight map not updating; ingest requests returning 503.
Scope: gateway + ingestion
Current mitigation: rolling back gateway to revision 42, checking Kafka broker health
Next update: 10:30 UTC
Incident commander: <name>
```

## Postmortem template

```md
# Incident Postmortem

- Incident ID:
- Severity:
- Start:
- End:
- Detection:
- Customer impact:
- Root cause:
- Contributing factors:
- What worked:
- What failed:
- Corrective actions:
  - [ ] Owner / due date
```
