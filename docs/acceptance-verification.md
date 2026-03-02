# Acceptance Verification

## Scope
- Date: `2026-03-01`
- Scope: P0 -> P10 release-readiness verification
- Method: module tests, Helm lint/render, Docker runtime smoke/E2E, observability target verification

## Commands executed
```bash
cmd.exe /c "cd /d C:\Users\NamP7\Documents\workspace\2026\tracking-2026 && set \"JAVA_HOME=C:\Users\NamP7\.jdks\ms-21.0.9\" && set \"PATH=%JAVA_HOME%\bin;%PATH%\" && gradlew.bat --no-daemon :service-processing:test :service-storage:test"

cmd.exe /c "cd /d C:\Users\NamP7\Documents\workspace\2026\tracking-2026 && set \"JAVA_HOME=C:\Users\NamP7\.jdks\ms-21.0.9\" && set \"PATH=%JAVA_HOME%\bin;%PATH%\" && gradlew.bat --no-daemon :service-auth:test :service-gateway:test :service-ingestion:test :service-processing:test :service-storage:test :service-broadcaster:test"

helm lint infrastructure/k8s/helm/tracking-platform -f infrastructure/k8s/helm/tracking-platform/values.yaml -f infrastructure/k8s/environments/dev/values.yaml
helm lint infrastructure/k8s/helm/tracking-platform -f infrastructure/k8s/helm/tracking-platform/values.yaml -f infrastructure/k8s/environments/stg/values.yaml
helm lint infrastructure/k8s/helm/tracking-platform -f infrastructure/k8s/helm/tracking-platform/values.yaml -f infrastructure/k8s/environments/prod/values.yaml

helm template tracking-dev infrastructure/k8s/helm/tracking-platform -f infrastructure/k8s/helm/tracking-platform/values.yaml -f infrastructure/k8s/environments/dev/values.yaml >/tmp/helm-dev.yaml
helm template tracking-stg infrastructure/k8s/helm/tracking-platform -f infrastructure/k8s/helm/tracking-platform/values.yaml -f infrastructure/k8s/environments/stg/values.yaml >/tmp/helm-stg.yaml
helm template tracking-prod infrastructure/k8s/helm/tracking-platform -f infrastructure/k8s/helm/tracking-platform/values.yaml -f infrastructure/k8s/environments/prod/values.yaml >/tmp/helm-prod.yaml

docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env.example up -d
SERVICE_GATEWAY_METRICS_TARGET=host.docker.internal:18080 \
SERVICE_AUTH_METRICS_TARGET=host.docker.internal:18081 \
SERVICE_INGESTION_METRICS_TARGET=host.docker.internal:18082 \
SERVICE_BROADCASTER_METRICS_TARGET=host.docker.internal:18083 \
SERVICE_STORAGE_METRICS_TARGET=host.docker.internal:18084 \
SERVICE_PROCESSING_METRICS_TARGET=host.docker.internal:18085 \
docker compose -f infrastructure/docker-compose-observability.yml --env-file infrastructure/.env.example up -d

bash .tmp/e2e/run_p0_p7_e2e.sh
curl -fsS http://localhost:9090/api/v1/targets
```

## Runtime matrix

| Flow | Result | Evidence |
|---|---|---|
| P0 infra + app health | PASS | `.tmp/e2e/matrix.tsv` row `P0-Infra+Apps health` |
| Auth register/login via gateway | PASS | `.tmp/e2e/matrix.tsv` rows `P2/P3 Auth register via gateway`, `P2 Admin login` |
| API key create + revoke | PASS | `.tmp/e2e/matrix.tsv` rows `P2 API key create`, `P2 Revoke API key` |
| Gateway centralized auth + rate limit + CORS | PASS | `.tmp/e2e/matrix.tsv` rows `P3 Centralized auth at gateway`, `P3 Rate limiting /auth/login`, `P3 CORS centralized` |
| Ingestion accept + backpressure path | PASS | `.tmp/e2e/matrix.tsv` row `P4 Ingestion accepted`; `service-ingestion` tests cover `429/503/413` failure modes |
| Processing -> Storage | PASS | `.tmp/e2e/matrix.tsv` row `P5->P6 Processing to Storage` |
| Broadcaster WebSocket push | PASS | `.tmp/e2e/matrix.tsv` row `P7 WebSocket broadcast via gateway` |
| Revocation propagation via Kafka | PASS | `.tmp/e2e/matrix.tsv` row `P3/P4 Revocation propagation (Kafka)` |
| Observability stack health | PASS | Prometheus/Grafana/Zipkin health endpoints returned `200` |
| Prometheus active scrape targets | PASS | `curl http://localhost:9090/api/v1/targets` returned service jobs with `health=up` after metrics target override |

## Cross-module evidence matrix

| Checklist item | Status | Evidence |
|---|---|---|
| End-to-end ingest -> raw -> processing -> live/historical -> storage/broadcaster | PASS | `.tmp/e2e/matrix.tsv`; `service-broadcaster/src/test/kotlin/com/tracking/broadcaster/BroadcasterWebSocketIT.kt`; `service-broadcaster/src/test/kotlin/com/tracking/broadcaster/kafka/LiveFlightConsumerTest.kt` |
| Kafka key = `icao` | PASS | `service-ingestion/src/main/kotlin/com/tracking/ingestion/kafka/RecordKeyStrategy.kt`; `service-ingestion/src/test/kotlin/com/tracking/ingestion/kafka/PartitionKeyingIT.kt` |
| API key revoke propagate to gateway + ingestion | PASS | `.tmp/e2e/matrix.tsv`; `service-ingestion/src/main/kotlin/com/tracking/ingestion/security/ApiKeyRevocationConsumer.kt`; `service-ingestion/src/test/kotlin/com/tracking/ingestion/security/ApiKeyRevocationConsumerTest.kt`; `service-gateway/src/test/kotlin/com/tracking/gateway/security/BlacklistServiceTest.kt` |
| Ingestion backpressure/load-shedding `429/503` | PASS | `service-ingestion/src/test/kotlin/com/tracking/ingestion/failure/KafkaBackpressureIT.kt`; `service-ingestion/src/test/kotlin/com/tracking/ingestion/failure/ProducerTimeoutIT.kt` |
| Ingestion bulk ingest + producer batching/compression | PASS | `service-ingestion/src/test/kotlin/com/tracking/ingestion/api/BatchIngestControllerTest.kt`; `service-ingestion/src/main/resources/application.yml` (`compression.type=lz4`) |
| Ingestion inject `traceparent` / `x-request-id` vào Kafka headers | PASS | `service-ingestion/src/test/kotlin/com/tracking/ingestion/kafka/KafkaHeadersPropagationTest.kt`; `service-ingestion/src/main/kotlin/com/tracking/ingestion/kafka/RawAdsbProducer.kt` |
| Ingestion graceful shutdown flush producer | PASS | `service-ingestion/src/test/kotlin/com/tracking/ingestion/lifecycle/ShutdownFlushIT.kt`; `service-ingestion/src/main/kotlin/com/tracking/ingestion/lifecycle/IngestionShutdownHook.kt` |
| P5 ICAO country + image URL/Planespotters enrichment | PASS | `service-processing/src/test/kotlin/com/tracking/processing/enrich/IcaoCountryResolverTest.kt`; `service-processing/src/test/kotlin/com/tracking/processing/enrich/PlanespottersPhotoProviderTest.kt`; `service-processing/src/main/kotlin/com/tracking/processing/enrich/IcaoCountryResolver.kt` |
| JWT bắt buộc cho WebSocket handshake | PASS | `service-broadcaster/src/test/kotlin/com/tracking/broadcaster/ws/JwtChannelInterceptorTest.kt`; `service-gateway/src/test/kotlin/com/tracking/gateway/filter/JwtAuthenticationFilterTest.kt` |
| Gateway route đúng cho auth/ingest/ws | PASS | `service-gateway/src/main/kotlin/com/tracking/gateway/config/GatewayRoutesConfig.kt` |
| Gateway fail-closed auth | PASS | `.tmp/e2e/matrix.tsv` row `P3 Centralized auth at gateway`; `service-gateway/src/test/kotlin/com/tracking/gateway/filter/JwtAuthenticationFilterTest.kt` |
| Gateway rate limit login + ingest | PASS | `.tmp/e2e/matrix.tsv` row `P3 Rate limiting /auth/login`; `service-gateway/src/test/kotlin/com/tracking/gateway/config/RateLimiterConfigTest.kt`; `service-gateway/src/main/resources/rate-limit-policy.yml` |
| Gateway centralized CORS | PASS | `.tmp/e2e/matrix.tsv` row `P3 CORS centralized`; `service-gateway/src/main/kotlin/com/tracking/gateway/config/CorsConfig.kt` |
| Gateway verify JWT offline qua JWKS cache | PASS | `service-gateway/src/test/kotlin/com/tracking/gateway/security/JwksCacheServiceTest.kt`; `service-gateway/src/main/kotlin/com/tracking/gateway/security/JwtTokenVerifier.kt` |
| Revocation SLA `<= 5s` ở gateway | PASS | `.tmp/e2e/matrix.tsv` row `P3/P4 Revocation propagation (Kafka)`; `service-gateway/src/main/kotlin/com/tracking/gateway/security/RevocationKafkaConsumer.kt`; `service-gateway/src/test/kotlin/com/tracking/gateway/security/RevocationKafkaConsumerIT.kt` |
| Gateway timeout/circuit-breaker deterministic | PASS | `service-gateway/src/test/kotlin/com/tracking/gateway/config/ResilienceConfigTest.kt`; `service-gateway/src/main/kotlin/com/tracking/gateway/config/ResilienceConfig.kt` |
| Gateway propagate `traceparent` / `x-request-id` | PASS | `service-gateway/src/test/kotlin/com/tracking/gateway/filter/TraceIdFilterTest.kt`; `service-gateway/src/test/kotlin/com/tracking/gateway/GatewayHardeningIT.kt`; `.tmp/e2e/matrix.tsv` row `P5->P6 Processing to Storage` includes persisted trace |
| Gateway chặn oversized payload `413` | PASS | `service-gateway/src/test/kotlin/com/tracking/gateway/GatewayHardeningIT.kt`; `service-gateway/src/test/kotlin/com/tracking/gateway/config/RequestSizeConfigTest.kt` |
| Historical data không đẩy realtime ra UI | PASS | `service-broadcaster/src/test/kotlin/com/tracking/broadcaster/kafka/LiveFlightConsumerTest.kt`; `service-broadcaster/src/main/kotlin/com/tracking/broadcaster/kafka/LiveFlightConsumer.kt` |
| Kinematic rule drop khi > `1200 km/h` | PASS | `service-processing/src/test/kotlin/com/tracking/processing/engine/FlightStateFusionEngineIT.kt`; `service-processing/src/test/kotlin/com/tracking/processing/validation/KinematicValidatorTest.kt` |
| Spatial filtering chỉ gửi flight trong viewport | PASS | `service-broadcaster/src/test/kotlin/com/tracking/broadcaster/spatial/SpatialPushEngineTest.kt`; `service-broadcaster/src/test/kotlin/com/tracking/broadcaster/BroadcasterWebSocketIT.kt`; `service-broadcaster/src/main/kotlin/com/tracking/broadcaster/viewport/ViewportRegistry.kt` |
| Storage idempotent | PASS | `service-storage/src/main/kotlin/com/tracking/storage/db/JdbcBatchWriter.kt`; `service-storage/src/test/kotlin/com/tracking/storage/db/JdbcBatchWriterTest.kt` |
| Batch insert Timescale ổn định | PASS | `service-storage/src/test/kotlin/com/tracking/storage/worker/BatchPersistWorkerTest.kt`; `service-storage/src/test/kotlin/com/tracking/storage/worker/StorageConsumerWorkerTest.kt`; `service-storage/src/main/kotlin/com/tracking/storage/worker/BatchPersistWorker.kt` |
| Internal services không public trực tiếp | PASS | Helm `infrastructure/k8s/helm/tracking-platform/templates/networkpolicy.yaml`; gateway-only ingress in `infrastructure/k8s/helm/tracking-platform/templates/ingress.yaml` |
| Không log token/credential/payload nhạy cảm | PASS | `docs/security-checklist.md`; targeted grep review across `service-*` plus protected filters/controllers |
| Core docker compose healthcheck pass | PASS | `docker ps`; `infrastructure/docker-compose.yml` healthchecks; `.tmp/e2e/matrix.tsv` row `P0-Infra+Apps health` |
| Observability compose up + scrape được metrics | PASS | `infrastructure/docker-compose-observability.yml`; `infrastructure/prometheus/render-prometheus-config.sh`; Prometheus `/api/v1/targets` showed service jobs `up` against Docker E2E ports `18080-18085` |
| Helm deployable cho dev/stg/prod, không expose internal services | PASS | `helm lint` + `helm template` for `dev/stg/prod`; `infrastructure/k8s/helm/tracking-platform/templates/networkpolicy.yaml`; `infrastructure/k8s/helm/tracking-platform/templates/pdb.yaml`; `infrastructure/k8s/helm/tracking-platform/templates/hpa.yaml` |

## Residual notes
- Verification này là local release gate, chưa phải cluster deployment proof.
- Helm side được verify ở mức lint/render cho `dev/stg/prod`; rollout thật vẫn cần môi trường Kubernetes.
- E2E runtime matrix hiện đang được lưu tại `.tmp/e2e/matrix.tsv` để phục vụ traceability nội bộ.
