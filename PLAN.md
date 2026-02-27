# PLAN v2 HARDENING - Tracking 2026

## Scope
- Chuyển kế hoạch từ scaffold ban đầu sang backlog triển khai production-ready.
- Bổ sung guardrails bắt buộc cho correctness under scale, security, clean architecture, SOLID, và vận hành.
- Trạng thái mặc định cho mọi task: `TODO`.

## Hardening Principles
- `Correctness under scale`: luôn đúng khi scale ngang (partitioning, ordering, idempotency).
- `Zero trust`: mọi hop đều xác thực/ủy quyền; không tin tưởng nội mạng.
- `Secure by default`: fail-closed cho auth, quản lý key/token an toàn, không log dữ liệu nhạy cảm.
- `SOLID pipeline`: tách stage rõ trách nhiệm, mở rộng qua interface.
- `Observability first`: metric/tracing/log chuẩn hóa để debug ở tải cao.
- `Test-first`: unit + integration + performance + security tests trước release.

## Milestones
1. `P0` Foundation & Runtime Baseline
2. `P1` common-dto Contract Stability
3. `P2` service-auth IAM Hardening
4. `P3` service-gateway Edge Security
5. `P4` service-ingestion Correctness & Throughput
6. `P5` service-processing Deterministic Pipeline
7. `P6` service-storage Idempotent Persistence
8. `P7` service-broadcaster Secure Realtime
9. `P8` frontend-ui Secure UX
10. `P9` NFR/Perf/Security Hardening
11. `P10` Release Readiness

## Backlog chi tiết

### P0 - Foundation & Runtime Baseline
- [x] `INF-00` Bootstrap runnable project
  - Files:
    - `gradlew`
    - `gradlew.bat`
    - `gradle/wrapper/gradle-wrapper.properties`
    - `.editorconfig`
- [x] `INF-01` Khởi tạo multi-module Gradle
  - Files:
    - `settings.gradle.kts`
    - `build.gradle.kts`
    - `gradle.properties`
    - `gradle/libs.versions.toml`
- [x] `INF-02` Local stack cho dev/test
  - Files:
    - `docker-compose.yml`
    - `infra/kafka/create-topics.sh`
    - `infra/postgres/init-timescale.sql`
    - `infra/redis/init-redis.conf`
- [x] `INF-03` Config chuẩn theo môi trường
  - Files:
    - `config/application-common.yml`
    - `.env.example`
- [x] `INF-04` CI cơ bản + quality gate
  - Files:
    - `.github/workflows/build.yml`
    - `.github/workflows/test.yml`
    - `.github/workflows/security.yml`
- [x] `INF-05` Tài liệu kiến trúc
  - Files:
    - `docs/architecture.md`
    - `docs/topic-contracts.md`
    - `docs/trust-boundaries.md`
    - `README.md`
- [x] `INF-06` Network security baseline (không bypass gateway)
  - Files:
    - `infra/network/README.md`
    - `infra/network/internal-services-policy.md`
- [x] `INF-07` Chuẩn hóa cấu trúc `infrastructure/` làm nguồn duy nhất cho runtime stack
  - Files:
    - `infrastructure/README.md`
    - `infrastructure/docker-compose.yml`
    - `infrastructure/docker-compose-observability.yml`
    - `infrastructure/prometheus/prometheus.yml`
    - `infrastructure/k8s/README.md`
- [x] `INF-08` Compose core dependencies (Kafka, Zookeeper, PostgreSQL, Redis) cho local/dev
  - Files:
    - `infrastructure/docker-compose.yml`
    - `infrastructure/kafka/create-topics.sh`
    - `infrastructure/postgres/init-timescale.sql`
    - `infrastructure/redis/init-redis.conf`
    - `infrastructure/.env.example`
- [x] `INF-09` Compose observability stack (Prometheus, Grafana, Zipkin) + wiring metrics/traces
  - Files:
    - `infrastructure/docker-compose-observability.yml`
    - `infrastructure/prometheus/prometheus.yml`
    - `observability/prometheus/alert-rules.yml`
    - `observability/grafana/ingestion-latency-dashboard.json`
    - `observability/otel/collector-config.yml`
- [x] `INF-10` Kubernetes baseline bằng Helm charts + values theo môi trường
  - Files:
    - `infrastructure/k8s/helm/tracking-platform/Chart.yaml`
    - `infrastructure/k8s/helm/tracking-platform/values.yaml`
    - `infrastructure/k8s/helm/tracking-platform/templates/_helpers.tpl`
    - `infrastructure/k8s/helm/tracking-platform/templates/gateway-deployment.yaml`
    - `infrastructure/k8s/helm/tracking-platform/templates/gateway-service.yaml`
    - `infrastructure/k8s/helm/tracking-platform/templates/ingestion-deployment.yaml`
    - `infrastructure/k8s/helm/tracking-platform/templates/processing-deployment.yaml`
    - `infrastructure/k8s/helm/tracking-platform/templates/storage-deployment.yaml`
    - `infrastructure/k8s/helm/tracking-platform/templates/auth-deployment.yaml`
    - `infrastructure/k8s/helm/tracking-platform/templates/broadcaster-deployment.yaml`
    - `infrastructure/k8s/environments/dev/values.yaml`
    - `infrastructure/k8s/environments/stg/values.yaml`
    - `infrastructure/k8s/environments/prod/values.yaml`
- [x] `INF-11` Migration plan từ `infra/` + root compose sang `infrastructure/` không phá local workflow
  - Files:
    - `docker-compose.yml`
    - `infra/network/README.md`
    - `README.md`
    - `docs/runbook.md`
- [x] `INF-12` Quality gate cho IaC (validate compose/helm/prometheus config trong CI)
  - Files:
    - `.github/workflows/infra-validate.yml`
    - `docs/infrastructure.md`

### P1 - Module common-dto Contract Stability
- [x] `DTO-01` Canonical ingest contract
  - Files:
    - `common-dto/src/main/kotlin/com/tracking/common/dto/CanonicalFlight.kt`
- [x] `DTO-02` Enriched payload cho UI/DB
  - Files:
    - `common-dto/src/main/kotlin/com/tracking/common/dto/EnrichedFlight.kt`
- [x] `DTO-03` Metadata model
  - Files:
    - `common-dto/src/main/kotlin/com/tracking/common/dto/AircraftMetadata.kt`
- [x] `DTO-04` WebSocket payload model
  - Files:
    - `common-dto/src/main/kotlin/com/tracking/common/dto/LiveFlightMessage.kt`
    - `common-dto/src/main/kotlin/com/tracking/common/dto/BoundingBox.kt`
- [x] `DTO-05` Serialization tests
  - Files:
    - `common-dto/src/test/kotlin/com/tracking/common/dto/CanonicalFlightSerializationTest.kt`
    - `common-dto/src/test/kotlin/com/tracking/common/dto/EnrichedFlightSerializationTest.kt`
- [x] `DTO-06` Schema evolution tests (backward/forward compatibility)
  - Files:
    - `common-dto/src/test/kotlin/com/tracking/common/dto/ContractCompatibilityTest.kt`

### P2 - Module service-auth IAM Hardening
- [x] `AUTH-01` Schema users/roles/api_keys/refresh_tokens
  - Files:
    - `service-auth/src/main/resources/db/migration/V1__init_auth.sql`
    - `service-auth/src/main/resources/db/migration/V2__seed_roles.sql`
- [x] `AUTH-02` Security + JWT core
  - Files:
    - `service-auth/src/main/kotlin/com/tracking/auth/config/SecurityConfig.kt`
    - `service-auth/src/main/kotlin/com/tracking/auth/security/JwtService.kt`
    - `service-auth/src/main/kotlin/com/tracking/auth/security/JwtAuthenticationFilter.kt`
- [x] `AUTH-03` User management
  - Files:
    - `service-auth/src/main/kotlin/com/tracking/auth/user/UserEntity.kt`
    - `service-auth/src/main/kotlin/com/tracking/auth/user/UserRepository.kt`
    - `service-auth/src/main/kotlin/com/tracking/auth/api/AuthController.kt`
    - `service-auth/src/main/kotlin/com/tracking/auth/api/AuthService.kt`
- [x] `AUTH-04` API key management
  - Files:
    - `service-auth/src/main/kotlin/com/tracking/auth/apikey/ApiKeyEntity.kt`
    - `service-auth/src/main/kotlin/com/tracking/auth/apikey/ApiKeyRepository.kt`
    - `service-auth/src/main/kotlin/com/tracking/auth/apikey/ApiKeyController.kt`
- [x] `AUTH-05` Internal verify APIs
  - Files:
    - `service-auth/src/main/kotlin/com/tracking/auth/internal/InternalTokenController.kt`
    - `service-auth/src/main/kotlin/com/tracking/auth/internal/InternalApiKeyController.kt`
- [x] `AUTH-06` JWT key rotation + JWKS
  - Files:
    - `service-auth/src/main/kotlin/com/tracking/auth/security/JwksKeyProvider.kt`
    - `service-auth/src/main/kotlin/com/tracking/auth/api/JwksController.kt`
- [x] `AUTH-07` Refresh token rotation + reuse detection
  - Files:
    - `service-auth/src/main/kotlin/com/tracking/auth/token/RefreshTokenService.kt`
    - `service-auth/src/main/kotlin/com/tracking/auth/token/RefreshTokenRepository.kt`
- [x] `AUTH-08` Revoke propagation events
  - Files:
    - `service-auth/src/main/kotlin/com/tracking/auth/events/AuthRevocationProducer.kt`
- [x] `AUTH-09` Security tests
  - Files:
    - `service-auth/src/test/kotlin/com/tracking/auth/security/JwtServiceTest.kt`
    - `service-auth/src/test/kotlin/com/tracking/auth/api/AuthControllerTest.kt`
    - `service-auth/src/test/kotlin/com/tracking/auth/apikey/ApiKeyControllerTest.kt`
    - `service-auth/src/test/kotlin/com/tracking/auth/SecurityIntegrationTest.kt`
    - `service-auth/src/test/kotlin/com/tracking/auth/security/JwksRotationIT.kt`

### P3 - Module service-gateway Edge Security
- [ ] `GW-01` Dynamic routing cho auth/ingest/ws
  - Files:
    - `service-gateway/src/main/resources/application.yml`
    - `service-gateway/src/main/kotlin/com/tracking/gateway/config/GatewayRoutesConfig.kt`
- [ ] `GW-02` Global authentication filters (JWT + API Key)
  - Files:
    - `service-gateway/src/main/kotlin/com/tracking/gateway/filter/JwtAuthenticationFilter.kt`
    - `service-gateway/src/main/kotlin/com/tracking/gateway/filter/ApiKeyFilter.kt`
    - `service-gateway/src/main/kotlin/com/tracking/gateway/security/TokenVerifier.kt`
- [ ] `GW-03` Rate limiting (Token Bucket + Redis)
  - Files:
    - `service-gateway/src/main/kotlin/com/tracking/gateway/config/RateLimiterConfig.kt`
    - `service-gateway/src/main/kotlin/com/tracking/gateway/config/RedisConfig.kt`
- [ ] `GW-04` CORS management tập trung
  - Files:
    - `service-gateway/src/main/kotlin/com/tracking/gateway/config/CorsConfig.kt`
- [ ] `GW-05` Security hardening tại edge
  - Files:
    - `service-gateway/src/main/kotlin/com/tracking/gateway/config/SecurityHeadersFilter.kt`
    - `service-gateway/src/main/kotlin/com/tracking/gateway/config/TrustedProxyConfig.kt`
    - `service-gateway/src/main/kotlin/com/tracking/gateway/config/TlsConfig.kt`
- [ ] `GW-06` Rate limit profiles theo route/principal
  - Files:
    - `service-gateway/src/main/resources/rate-limit-policy.yml`
- [ ] `GW-07` Tests
  - Files:
    - `service-gateway/src/test/kotlin/com/tracking/gateway/filter/JwtAuthenticationFilterTest.kt`
    - `service-gateway/src/test/kotlin/com/tracking/gateway/filter/ApiKeyFilterTest.kt`
    - `service-gateway/src/test/kotlin/com/tracking/gateway/config/RateLimiterConfigTest.kt`
    - `service-gateway/src/test/kotlin/com/tracking/gateway/RoutingIntegrationTest.kt`
    - `service-gateway/src/test/kotlin/com/tracking/gateway/SecurityHeadersIT.kt`
- [ ] `GW-08` JWT Offline Verification & JWKS Caching
  - Files:
    - `service-gateway/src/main/kotlin/com/tracking/gateway/security/JwksCacheService.kt`
- [ ] `GW-09` Distributed Blacklist Consumer (Revocation)
  - Files:
    - `service-gateway/src/main/kotlin/com/tracking/gateway/security/RevocationKafkaConsumer.kt`
    - `service-gateway/src/main/kotlin/com/tracking/gateway/security/BlacklistService.kt`
- [ ] `GW-10` Circuit Breaker & Strict TTL Timeouts
  - Files:
    - `service-gateway/src/main/resources/application.yml`
    - `service-gateway/src/main/kotlin/com/tracking/gateway/config/ResilienceConfig.kt`
- [ ] `GW-11` Gateway TraceID Context Propagation
  - Files:
    - `service-gateway/src/main/kotlin/com/tracking/gateway/filter/TraceIdFilter.kt`
- [ ] `GW-12` Chống DoS: Request Size Limiter
  - Files:
    - `service-gateway/src/main/kotlin/com/tracking/gateway/config/RequestSizeConfig.kt`
- [ ] `GW-13` Tests cho hardening GW-08..GW-12
  - Files:
    - `service-gateway/src/test/kotlin/com/tracking/gateway/security/JwksCacheServiceTest.kt`
    - `service-gateway/src/test/kotlin/com/tracking/gateway/security/RevocationKafkaConsumerIT.kt`
    - `service-gateway/src/test/kotlin/com/tracking/gateway/security/BlacklistServiceTest.kt`
    - `service-gateway/src/test/kotlin/com/tracking/gateway/config/ResilienceConfigTest.kt`
    - `service-gateway/src/test/kotlin/com/tracking/gateway/filter/TraceIdFilterTest.kt`
    - `service-gateway/src/test/kotlin/com/tracking/gateway/config/RequestSizeConfigTest.kt`
    - `service-gateway/src/test/kotlin/com/tracking/gateway/GatewayHardeningIT.kt`

#### P3 Dependency Order (Must Follow)
1. `GW-01` + `GW-04` + `GW-05` (routing + trust boundary + edge headers) làm baseline.
2. `GW-08` (offline JWT verify + JWKS cache) trước khi finalize `GW-02`.
3. `GW-02` dùng `TokenVerifier` dựa trên cache JWKS (không gọi auth-service cho mỗi request JWT).
4. `GW-09` (revocation consumer + blacklist state) sau khi `GW-02` hoạt động.
5. `GW-03` + `GW-06` (rate limit) sau auth để có principal-aware policy.
6. `GW-10` (timeout + circuit breaker) cho mọi outbound call còn lại.
7. `GW-11` + `GW-12` (trace propagation + request size limiter) trước integration pass.
8. `GW-07` + `GW-13` chạy full test matrix, chỉ pass khi toàn bộ acceptance criteria đạt.

#### P3 Acceptance Criteria
- [ ] JWT hợp lệ (signed bởi key trong JWKS cache) được verify offline tại gateway, không phụ thuộc round-trip realtime đến auth-service.
- [ ] Khi `kid` không tồn tại: gateway trigger refresh JWKS; nếu refresh thất bại thì fail-closed (401/403), không bypass auth.
- [ ] Revocation event (`auth-revocation`) propagate đến tất cả instance gateway và chặn token/api-key bị revoke trong SLA mục tiêu `<= 5s`.
- [ ] Blacklist/revocation state có TTL rõ ràng và không ngắn hơn TTL access-token để tránh replay cửa sổ ngắn.
- [ ] Outbound calls từ gateway có timeout strict cấu hình trong `application.yml`; circuit breaker mở khi downstream lỗi liên tục và gateway trả lỗi deterministic (không treo request).
- [ ] Gateway luôn propagate `traceparent` hoặc `x-request-id` xuống downstream; nếu thiếu thì tự sinh và trả lại qua response header.
- [ ] Request vượt ngưỡng size policy theo route bị chặn với `413 Payload Too Large`; request hợp lệ không bị false-positive.
- [ ] Tất cả testcase trong `GW-07` + `GW-13` pass trong CI và có tối thiểu 1 integration test đa-instance cho revocation propagation.

### P4 - Module service-ingestion Correctness & Throughput
- [ ] `ING-01` WebFlux ingest endpoint
  - Files:
    - `service-ingestion/src/main/kotlin/com/tracking/ingestion/api/TrackingController.kt`
    - `service-ingestion/src/main/kotlin/com/tracking/ingestion/api/IngestRequestValidator.kt`
- [ ] `ING-02` API key check từ local cache
  - Files:
    - `service-ingestion/src/main/kotlin/com/tracking/ingestion/security/ApiKeyAuthWebFilter.kt`
    - `service-ingestion/src/main/kotlin/com/tracking/ingestion/security/ApiKeyCacheService.kt`
    - `service-ingestion/src/main/kotlin/com/tracking/ingestion/security/AuthServiceClient.kt`
- [ ] `ING-03` Kafka producer raw-adsb (key theo `icao`)
  - Files:
    - `service-ingestion/src/main/kotlin/com/tracking/ingestion/kafka/KafkaProducerConfig.kt`
    - `service-ingestion/src/main/kotlin/com/tracking/ingestion/kafka/RawAdsbProducer.kt`
    - `service-ingestion/src/main/kotlin/com/tracking/ingestion/kafka/RecordKeyStrategy.kt`
- [ ] `ING-04` Revoke sync cho API key cache
  - Files:
    - `service-ingestion/src/main/kotlin/com/tracking/ingestion/security/ApiKeyRevocationConsumer.kt`
- [ ] `ING-05` Error handling + metrics
  - Files:
    - `service-ingestion/src/main/kotlin/com/tracking/ingestion/api/GlobalExceptionHandler.kt`
    - `service-ingestion/src/main/kotlin/com/tracking/ingestion/metrics/IngestionMetrics.kt`
- [ ] `ING-06` Tests
  - Files:
    - `service-ingestion/src/test/kotlin/com/tracking/ingestion/api/TrackingControllerTest.kt`
    - `service-ingestion/src/test/kotlin/com/tracking/ingestion/security/ApiKeyAuthWebFilterTest.kt`
    - `service-ingestion/src/test/kotlin/com/tracking/ingestion/kafka/RawAdsbProducerTest.kt`
    - `service-ingestion/src/test/kotlin/com/tracking/ingestion/kafka/PartitionKeyingIT.kt`

### P5 - Module service-processing Deterministic Pipeline
- [ ] `PROC-01` Consume raw + ordering guard theo `icao`
  - Files:
    - `service-processing/src/main/kotlin/com/tracking/processing/kafka/ProcessingConsumerConfig.kt`
    - `service-processing/src/main/kotlin/com/tracking/processing/engine/FlightStateFusionEngine.kt`
- [ ] `PROC-02` SOLID pipeline abstraction
  - Files:
    - `service-processing/src/main/kotlin/com/tracking/processing/pipeline/FlightProcessingStage.kt`
    - `service-processing/src/main/kotlin/com/tracking/processing/pipeline/PipelineExecutor.kt`
- [ ] `PROC-03` Dedup hash TTL=2s
  - Files:
    - `service-processing/src/main/kotlin/com/tracking/processing/dedup/DedupKeyService.kt`
    - `service-processing/src/main/kotlin/com/tracking/processing/dedup/DedupCacheConfig.kt`
- [ ] `PROC-04` Out-of-order event-time handling
  - Files:
    - `service-processing/src/main/kotlin/com/tracking/processing/eventtime/EventTimeResolver.kt`
    - `service-processing/src/main/kotlin/com/tracking/processing/state/LastKnownStateStore.kt`
    - `service-processing/src/main/kotlin/com/tracking/processing/routing/TopicRouter.kt`
- [ ] `PROC-05` Kinematic validation
  - Files:
    - `service-processing/src/main/kotlin/com/tracking/processing/validation/KinematicValidator.kt`
    - `service-processing/src/main/kotlin/com/tracking/processing/geo/Haversine.kt`
- [ ] `PROC-06` Data enrichment
  - Files:
    - `service-processing/src/main/kotlin/com/tracking/processing/enrich/ReferenceDataLoader.kt`
    - `service-processing/src/main/kotlin/com/tracking/processing/enrich/ReferenceDataCache.kt`
    - `service-processing/src/main/kotlin/com/tracking/processing/enrich/FlightEnricher.kt`
- [ ] `PROC-07` Split topic publish + DLQ
  - Files:
    - `service-processing/src/main/kotlin/com/tracking/processing/kafka/ProcessingProducer.kt`
    - `service-processing/src/main/kotlin/com/tracking/processing/kafka/InvalidRecordDlqProducer.kt`
- [ ] `PROC-08` Tests
  - Files:
    - `service-processing/src/test/kotlin/com/tracking/processing/dedup/DedupKeyServiceTest.kt`
    - `service-processing/src/test/kotlin/com/tracking/processing/eventtime/EventTimeResolverTest.kt`
    - `service-processing/src/test/kotlin/com/tracking/processing/validation/KinematicValidatorTest.kt`
    - `service-processing/src/test/kotlin/com/tracking/processing/engine/FlightStateFusionEngineIT.kt`
    - `service-processing/src/test/kotlin/com/tracking/processing/pipeline/PipelineDeterminismIT.kt`

### P6 - Module service-storage Idempotent Persistence
- [ ] `STO-01` Timescale hypertable + indexes
  - Files:
    - `service-storage/src/main/resources/db/migration/V1__flight_positions.sql`
- [ ] `STO-02` Unique key + upsert semantics
  - Files:
    - `service-storage/src/main/resources/db/migration/V2__flight_positions_constraints.sql`
- [ ] `STO-03` Consume live/historical topics
  - Files:
    - `service-storage/src/main/kotlin/com/tracking/storage/kafka/StorageConsumerConfig.kt`
    - `service-storage/src/main/kotlin/com/tracking/storage/worker/StorageConsumerWorker.kt`
- [ ] `STO-04` Batch write 5k-10k rows
  - Files:
    - `service-storage/src/main/kotlin/com/tracking/storage/worker/BatchPersistWorker.kt`
    - `service-storage/src/main/kotlin/com/tracking/storage/db/JdbcBatchWriter.kt`
    - `service-storage/src/main/kotlin/com/tracking/storage/buffer/FlightBuffer.kt`
- [ ] `STO-05` Retry/DLQ/quarantine/metrics
  - Files:
    - `service-storage/src/main/kotlin/com/tracking/storage/retry/StorageRetryPolicy.kt`
    - `service-storage/src/main/kotlin/com/tracking/storage/kafka/StorageDlqProducer.kt`
    - `service-storage/src/main/kotlin/com/tracking/storage/metrics/StorageMetrics.kt`
    - `service-storage/src/main/resources/db/migration/V3__quarantine_table.sql`
- [ ] `STO-06` Tests
  - Files:
    - `service-storage/src/test/kotlin/com/tracking/storage/db/JdbcBatchWriterTest.kt`
    - `service-storage/src/test/kotlin/com/tracking/storage/worker/BatchPersistWorkerTest.kt`
    - `service-storage/src/test/kotlin/com/tracking/storage/StorageIntegrationTest.kt`
    - `service-storage/src/test/kotlin/com/tracking/storage/IdempotencyIT.kt`

### P7 - Module service-broadcaster Secure Realtime
- [ ] `BRO-01` WebSocket/STOMP + JWT handshake
  - Files:
    - `service-broadcaster/src/main/kotlin/com/tracking/broadcaster/ws/WebSocketConfig.kt`
    - `service-broadcaster/src/main/kotlin/com/tracking/broadcaster/ws/JwtChannelInterceptor.kt`
- [ ] `BRO-02` Viewport registry theo session
  - Files:
    - `service-broadcaster/src/main/kotlin/com/tracking/broadcaster/viewport/ViewportRegistry.kt`
    - `service-broadcaster/src/main/kotlin/com/tracking/broadcaster/viewport/ViewportMessageHandler.kt`
- [ ] `BRO-03` Spatial filtering
  - Files:
    - `service-broadcaster/src/main/kotlin/com/tracking/broadcaster/spatial/BoundingBoxMatcher.kt`
    - `service-broadcaster/src/main/kotlin/com/tracking/broadcaster/spatial/SpatialPushEngine.kt`
- [ ] `BRO-04` Consume live topic + push session đích
  - Files:
    - `service-broadcaster/src/main/kotlin/com/tracking/broadcaster/kafka/LiveFlightConsumer.kt`
    - `service-broadcaster/src/main/kotlin/com/tracking/broadcaster/ws/SessionPushService.kt`
- [ ] `BRO-05` WS hardening (quota/rate/cleanup)
  - Files:
    - `service-broadcaster/src/main/kotlin/com/tracking/broadcaster/ws/SessionRateLimiter.kt`
    - `service-broadcaster/src/main/kotlin/com/tracking/broadcaster/ws/StaleSessionCleaner.kt`
- [ ] `BRO-06` Tests
  - Files:
    - `service-broadcaster/src/test/kotlin/com/tracking/broadcaster/ws/JwtChannelInterceptorTest.kt`
    - `service-broadcaster/src/test/kotlin/com/tracking/broadcaster/viewport/ViewportRegistryTest.kt`
    - `service-broadcaster/src/test/kotlin/com/tracking/broadcaster/spatial/SpatialPushEngineTest.kt`
    - `service-broadcaster/src/test/kotlin/com/tracking/broadcaster/BroadcasterWebSocketIT.kt`
    - `service-broadcaster/src/test/kotlin/com/tracking/broadcaster/ws/SessionRateLimiterTest.kt`

### P8 - Module frontend-ui Secure UX
- [ ] `UI-01` React + Vite + Tailwind skeleton
  - Files:
    - `frontend-ui/package.json`
    - `frontend-ui/vite.config.ts`
    - `frontend-ui/src/main.tsx`
- [ ] `UI-02` Auth state + auth pages
  - Files:
    - `frontend-ui/src/features/auth/store/useAuthStore.ts`
    - `frontend-ui/src/features/auth/api/authApi.ts`
    - `frontend-ui/src/features/auth/pages/LoginPage.tsx`
    - `frontend-ui/src/features/auth/pages/RegisterPage.tsx`
- [ ] `UI-03` HTTP client + interceptor
  - Files:
    - `frontend-ui/src/shared/api/httpClient.ts`
- [ ] `UI-04` Token handling hardening
  - Files:
    - `frontend-ui/src/features/auth/security/tokenStorage.ts`
    - `frontend-ui/src/features/auth/security/tokenRefreshScheduler.ts`
- [ ] `UI-05` Map + WebSocket hook
  - Files:
    - `frontend-ui/src/features/map/components/MapView.tsx`
    - `frontend-ui/src/features/map/hooks/useFlightSocket.ts`
- [ ] `UI-06` useRef + RAF render pipeline
  - Files:
    - `frontend-ui/src/features/map/store/useFlightRefStore.ts`
    - `frontend-ui/src/features/map/render/useAnimationFrameRenderer.ts`
    - `frontend-ui/src/features/map/render/flightLayer.ts`
- [ ] `UI-07` Admin pages
  - Files:
    - `frontend-ui/src/features/admin/pages/UserManagementPage.tsx`
    - `frontend-ui/src/features/admin/pages/ApiKeyManagementPage.tsx`
- [ ] `UI-08` Frontend tests
  - Files:
    - `frontend-ui/src/features/auth/store/useAuthStore.test.ts`
    - `frontend-ui/src/features/map/hooks/useFlightSocket.test.ts`
    - `frontend-ui/src/features/map/render/flightLayer.test.ts`
    - `frontend-ui/src/features/auth/security/tokenStorage.test.ts`

### P9 - NFR/Perf/Security Hardening
- [ ] `NFR-01` Load test ingest 100k msg/s
  - Files:
    - `perf/k6/ingestion-load.js`
    - `perf/reports/README.md`
- [ ] `NFR-02` Soak test 24h + memory profiling
  - Files:
    - `perf/soak/soak-test-plan.md`
- [ ] `NFR-03` Latency dashboard + alerts
  - Files:
    - `observability/grafana/ingestion-latency-dashboard.json`
    - `observability/prometheus/alert-rules.yml`
- [ ] `NFR-04` Distributed tracing baseline
  - Files:
    - `observability/otel/collector-config.yml`
    - `docs/observability.md`
- [ ] `NFR-05` Security scanning + dependency audit
  - Files:
    - `.github/workflows/security.yml`
    - `docs/security-checklist.md`

### P10 - Release Readiness
- [ ] `REL-01` Runbook vận hành và incident response
  - Files:
    - `docs/runbook.md`
    - `docs/incident-response.md`
- [ ] `REL-02` Backup/restore drill cho PostgreSQL/Timescale
  - Files:
    - `infra/postgres/backup-restore.md`
- [ ] `REL-03` Threat model & abuse cases
  - Files:
    - `docs/threat-model.md`

## Cross-module acceptance checklist (v2)
- [ ] End-to-end luồng: ingest -> raw -> processing -> live/historical -> storage/broadcaster.
- [ ] Producer luôn set Kafka key = `icao`; ordering theo partition được kiểm chứng bằng test.
- [ ] API key crawler có thể revoke tức thời và propagate đến gateway/ingestion.
- [ ] JWT bắt buộc cho WebSocket handshake.
- [ ] Gateway route đúng cho `/api/v1/auth/**`, `/api/v1/ingest/**`, `/ws/live/**`.
- [ ] Gateway chặn request sai auth tại lớp cửa vào (401/403 chuẩn, fail-closed).
- [ ] Gateway rate limit được `/api/v1/auth/login` theo IP và `/api/v1/ingest/**` theo API key.
- [ ] CORS xử lý tập trung tại Gateway cho domain frontend.
- [ ] Gateway verify JWT offline qua JWKS cache; auth-service không nằm trên critical path của mọi request JWT.
- [ ] Revocation event `auth-revocation` được consume tại gateway và block token/api-key bị revoke trong SLA `<= 5s`.
- [ ] Gateway áp dụng timeout/circuit-breaker cho outbound dependency và trả lỗi deterministic khi downstream lỗi.
- [ ] Gateway propagate `traceparent`/`x-request-id` end-to-end qua downstream services.
- [ ] Gateway chặn oversized payload theo policy route với mã `413 Payload Too Large`.
- [ ] Historical data không đẩy realtime ra UI.
- [ ] Kinematic rule drop khi vận tốc > 1200 km/h.
- [ ] Spatial filtering chỉ gửi flight trong viewport client.
- [ ] Storage idempotent (retry không tạo duplicate rows).
- [ ] Batch insert Timescale ổn định ở tải cao.
- [ ] Không service nội bộ nào public trực tiếp ra internet (không bypass gateway).
- [ ] Không log token, api key, credential hoặc payload nhạy cảm.
- [ ] `infrastructure/docker-compose.yml` khởi chạy đủ Kafka/Zookeeper/PostgreSQL/Redis với healthcheck pass.
- [ ] `infrastructure/docker-compose-observability.yml` khởi chạy Prometheus/Grafana/Zipkin và scrape được metrics.
- [ ] Helm chart trong `infrastructure/k8s` deploy được theo `dev/stg/prod` values và không expose service nội bộ ra public.
