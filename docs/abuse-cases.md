# Abuse Cases

## Priority scenarios

| Abuse case | Entry point | Expected control | Detection |
|---|---|---|---|
| Credential stuffing on login | `/api/v1/auth/login` | Gateway per-IP rate limit + auth audit logs | `GatewayHigh5xxRate`, login error spikes |
| Leaked crawler API key replay | `/api/v1/ingest/**` | Revoke event propagation to gateway + ingestion | auth-revocation lag, `401/403` spike |
| Oversized ingest payload | gateway ingest route | Request size limiter returns `413` | `413` logs + gateway metrics |
| Kafka slowdown causing memory pressure | ingestion producer path | Backpressure + `429/503` instead of OOM | ingestion reject counters |
| JWT reuse after revoke | `/ws/live/**`, auth routes | Blacklist/revocation cache | websocket reject spike |
| Viewport flood to amplify push fan-out | STOMP viewport updates | Session viewport rate limit | `ws.viewport.updates`, session rate limit logs |
| Historical telemetry shown as live | broadcaster consumer | historical guard blocks realtime push | broadcaster tests + live topic checks |
| Duplicate storage insert on retry | storage writer | `ON CONFLICT DO NOTHING` | idempotency integration test |

## Abuse response principles
1. Fail closed at the edge first.
2. Preserve trace and audit evidence before mitigation.
3. Prefer scoped rollback over full-stack restart.
4. Capture offsets, timestamps, request IDs, and affected API keys/users.
