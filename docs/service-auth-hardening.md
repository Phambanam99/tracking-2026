# Service Auth Hardening Guide (P2)

Tài liệu này mô tả các phần đã hardening trong `service-auth` để đáp ứng yêu cầu production.

## 1) Secret Management (Fail Fast)

### Mục tiêu
- Không cho phép chạy với secret mặc định/hardcode.
- Bắt buộc cấu hình secret qua biến môi trường hoặc secret manager.

### Đã hoàn thiện
- `auth.internal-api-key` bắt buộc có giá trị.
- `auth.token-hash-pepper` bắt buộc có giá trị và tối thiểu 24 ký tự.
- Service fail startup ngay nếu cấu hình sai.

### File liên quan
- `service-auth/src/main/resources/application.yml`
- `service-auth/src/main/kotlin/com/tracking/auth/internal/InternalRequestSecurity.kt`
- `service-auth/src/main/kotlin/com/tracking/auth/security/TokenHashingService.kt`

### Biến môi trường bắt buộc
- `AUTH_INTERNAL_API_KEY`
- `AUTH_TOKEN_HASH_PEPPER`

## 2) Internal API Security (Zero Trust)

### Mục tiêu
- Endpoint `/internal/**` không còn `permitAll`.
- Bắt buộc xác thực bằng `x-internal-api-key`.

### Đã hoàn thiện
- Thêm `InternalApiKeyAuthenticationFilter`.
- Security rule: `/internal/**` yêu cầu `ROLE_INTERNAL`.
- Filter gắn authentication nội bộ khi key hợp lệ, trả `401` nếu không hợp lệ.

### File liên quan
- `service-auth/src/main/kotlin/com/tracking/auth/internal/InternalApiKeyAuthenticationFilter.kt`
- `service-auth/src/main/kotlin/com/tracking/auth/config/SecurityConfig.kt`
- `service-auth/src/main/kotlin/com/tracking/auth/internal/InternalTokenController.kt`
- `service-auth/src/main/kotlin/com/tracking/auth/internal/InternalApiKeyController.kt`

## 3) JWT Key Persistence + Rotation + JWKS

### Mục tiêu
- Không invalid token hàng loạt sau restart.
- Verify token theo `kid` để giảm chi phí xác thực.
- Có chiến lược giữ key cũ theo retention.

### Đã hoàn thiện
- Signing keys được lưu DB (`jwt_signing_keys`), không chỉ in-memory.
- Khởi động lại service vẫn đọc lại active key cũ.
- `JwtService` ưu tiên verify theo `kid`.
- Key rotation có prune key cũ theo `auth.jwt.max-retained-keys`.

### File liên quan
- `service-auth/src/main/resources/db/migration/V3__jwt_signing_keys.sql`
- `service-auth/src/main/kotlin/com/tracking/auth/security/JwtSigningKeyEntity.kt`
- `service-auth/src/main/kotlin/com/tracking/auth/security/JwtSigningKeyRepository.kt`
- `service-auth/src/main/kotlin/com/tracking/auth/security/JwksKeyProvider.kt`
- `service-auth/src/main/kotlin/com/tracking/auth/security/JwtService.kt`

### Cấu hình
- `auth.jwt.max-retained-keys` (mặc định: `5`)

## 4) Refresh Token Rotation (Race-safe)

### Mục tiêu
- Chặn race condition khi refresh đồng thời.
- Đảm bảo một refresh token chỉ được dùng một lần.

### Đã hoàn thiện
- Dùng update có điều kiện (`where revoked = false`) để revoke atomically.
- Nếu update thất bại -> coi là reuse, revoke toàn bộ token active của user.

### File liên quan
- `service-auth/src/main/kotlin/com/tracking/auth/token/RefreshTokenRepository.kt`
- `service-auth/src/main/kotlin/com/tracking/auth/token/RefreshTokenService.kt`

## 5) Revocation Event Reliability

### Mục tiêu
- Không silent fail khi publish revoke event.

### Đã hoàn thiện
- `AuthRevocationProducer` publish đồng bộ với timeout.
- Nếu publish lỗi -> ném exception rõ ràng (`IllegalStateException`) thay vì bỏ qua.

### File liên quan
- `service-auth/src/main/kotlin/com/tracking/auth/events/AuthRevocationProducer.kt`

## 6) User Schema Consistency (Case-insensitive Unique)

### Mục tiêu
- Đồng nhất giữa logic `IgnoreCase` và constraint DB.

### Đã hoàn thiện
- Bỏ unique cũ dạng case-sensitive.
- Thêm unique index theo `LOWER(username)` và `LOWER(email)`.

### File liên quan
- `service-auth/src/main/resources/db/migration/V4__users_case_insensitive_unique.sql`
- `service-auth/src/main/kotlin/com/tracking/auth/user/UserRepository.kt`

## 7) Admin Bootstrap

### Mục tiêu
- Có cơ chế bootstrap quyền quản trị để vận hành API key management.

### Đã hoàn thiện
- `AdminBootstrapInitializer` tạo/cập nhật admin khi bật cờ bootstrap.
- Tự động đảm bảo role `ROLE_ADMIN` + `ROLE_USER`.

### File liên quan
- `service-auth/src/main/kotlin/com/tracking/auth/user/AdminBootstrapInitializer.kt`

### Cấu hình bootstrap
- `AUTH_BOOTSTRAP_ADMIN_ENABLED`
- `AUTH_BOOTSTRAP_ADMIN_USERNAME`
- `AUTH_BOOTSTRAP_ADMIN_EMAIL`
- `AUTH_BOOTSTRAP_ADMIN_PASSWORD`

## 8) Test Coverage đã bổ sung

### Test bảo mật/functional
- `service-auth/src/test/kotlin/com/tracking/auth/SecurityIntegrationTest.kt`
- `service-auth/src/test/kotlin/com/tracking/auth/internal/InternalRequestSecurityTest.kt`
- `service-auth/src/test/kotlin/com/tracking/auth/security/JwtServiceTest.kt`
- `service-auth/src/test/kotlin/com/tracking/auth/security/JwksRotationIT.kt`
- `service-auth/src/test/kotlin/com/tracking/auth/security/JwksKeyProviderPersistenceIT.kt`
- `service-auth/src/test/kotlin/com/tracking/auth/api/AuthControllerTest.kt`
- `service-auth/src/test/kotlin/com/tracking/auth/apikey/ApiKeyControllerTest.kt`

### Lệnh verify
```bash
./gradlew :service-auth:test
./gradlew test
```
