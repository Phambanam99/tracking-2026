# Hướng Dẫn Sử Dụng: service-auth

## 1. Giới Thiệu

**Service-auth** quản lý toàn bộ việc xác thực người dùng, cấp phát token JWT, quản lý API key cho nguồn radar, và quản trị người dùng. Đây là service nền tảng — mọi service khác phụ thuộc vào nó.

---

## 2. Khởi Động Nhanh

### Yêu cầu
- Java 21
- PostgreSQL đang chạy (port 5432)
- Kafka đang chạy (port 9092)

### Cách chạy

```bash
# 1. Khởi động hạ tầng
docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env.example up -d

# 2. Chạy service-auth
./gradlew :service-auth:bootRun --args='--spring.profiles.active=local'
```

### Kiểm tra sức khỏe

```bash
curl -fsS http://localhost:8081/actuator/health
# Kết quả mong đợi: {"status":"UP"}
```

---

## 3. Cấu Hình

### Biến môi trường quan trọng

| Biến | Bắt buộc | Mặc định | Giải thích |
|---|---|---|---|
| `SPRING_DATASOURCE_URL` | ✅ | — | Đường dẫn database, ví dụ: `jdbc:postgresql://localhost:5432/tracking` |
| `SPRING_DATASOURCE_USERNAME` | ✅ | — | Tên đăng nhập database |
| `SPRING_DATASOURCE_PASSWORD` | ✅ | — | Mật khẩu database |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | ✅ | `localhost:9092` | Địa chỉ Kafka broker |
| `AUTH_INTERNAL_API_KEY` | ⚠️ | `tracking-internal-key-2026` | Khóa nội bộ cho gateway goi API nội bộ. **Phải đổi trên production!** |
| `AUTH_TOKEN_HASH_PEPPER` | ⚠️ | `tracking-pepper-2026-...` | Muối cho hash token. **Phải đổi trên production!** |
| `AUTH_JWT_MASTER_KEY` | ⚠️ | `tracking-master-key-...` | Khóa mã hóa RSA private key. **Phải đổi!** |
| `AUTH_BOOTSTRAP_ADMIN_ENABLED` | Không | `false` | Đặt `true` để tạo admin mặc định khi khởi động |
| `AUTH_BOOTSTRAP_ADMIN_USERNAME` | Không | — | Username admin cần tạo |
| `AUTH_BOOTSTRAP_ADMIN_PASSWORD` | Không | — | Mật khẩu admin cần tạo |

### Profile `local` (dùng khi phát triển)

Profile `local` tự động bật:
- Flyway baseline ở version 5 (cho database cũ)
- Bootstrap admin (nếu có cấu hình)
- Kết nối database/Kafka local

---

## 4. Hướng Dẫn Sử Dụng API

### 4.1 Đăng ký tài khoản

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "nguyen_van_a",
    "email": "nguyenvana@example.com",
    "password": "MatKhau@12345678"
  }'
```

**Lưu ý về mật khẩu:** Tối thiểu 12 ký tự, phải có chữ hoa, chữ thường, số, và ký tự đặc biệt (`@$!%*?&`).

**Kết quả:**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

### 4.2 Đăng nhập

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "nguyen_van_a",
    "password": "MatKhau@12345678"
  }'
```

**Kết quả:** Trả về `accessToken` và `refreshToken` giống đăng ký.

**Chú ý:**
- Đăng nhập sai **5 lần liên tiếp** → tài khoản bị khóa **15 phút**
- Tài khoản bị vô hiệu hóa → trả về `403 Forbidden`

### 4.3 Làm mới token (Refresh)

Khi access token hết hạn (sau 15 phút), dùng refresh token để lấy token mới:

```bash
curl -X POST http://localhost:8080/api/v1/auth/refresh-token \
  -H 'Content-Type: application/json' \
  -d '{
    "refreshToken": "eyJhbGciOiJSUzI1NiIs..."
  }'
```

**Lưu ý:** Mỗi refresh token chỉ dùng **1 lần**. Sau khi dùng, token cũ bị vô hiệu hóa và cấp token mới.

### 4.4 Đăng xuất

```bash
curl -X POST http://localhost:8080/api/v1/auth/logout \
  -H 'Content-Type: application/json' \
  -d '{
    "refreshToken": "eyJhbGciOiJSUzI1NiIs..."
  }'
```

### 4.5 Tạo API Key (chỉ Admin)

Dùng cho nguồn radar/crawler gửi dữ liệu:

```bash
# Đăng nhập admin trước
TOKEN=$(curl -s http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@12345678"}' | jq -r .accessToken)

# Tạo API key
curl -X POST http://localhost:8080/api/v1/auth/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"sourceId": "RADAR-HN"}'
```

**Kết quả:**
```json
{
  "id": 1,
  "sourceId": "RADAR-HN",
  "apiKey": "trk_live_ABCdef123456...",
  "active": true
}
```

> ⚠️ **Quan trọng:** `apiKey` chỉ hiển thị **1 lần duy nhất** khi tạo. Hãy lưu lại ngay! Hệ thống chỉ lưu hash, không thể khôi phục plaintext.

### 4.6 Thu hồi API Key (chỉ Admin)

```bash
curl -X POST http://localhost:8080/api/v1/auth/api-keys/1/revoke \
  -H "Authorization: Bearer $TOKEN"
# Kết quả: HTTP 204 No Content
```

Khi thu hồi, hệ thống phát sự kiện qua Kafka. Gateway và Ingestion sẽ chặn API key này trong vòng **≤ 5 giây**.

### 4.7 Quản lý người dùng (chỉ Admin)

**Xem danh sách:**
```bash
curl -X GET "http://localhost:8080/api/v1/auth/users?page=0&size=20" \
  -H "Authorization: Bearer $TOKEN"
```

**Vô hiệu hóa người dùng:**
```bash
curl -X PUT http://localhost:8080/api/v1/auth/users/2/disable \
  -H "Authorization: Bearer $TOKEN"
# Kết quả: HTTP 204 No Content
```

**Kích hoạt lại:**
```bash
curl -X PUT http://localhost:8080/api/v1/auth/users/2/enable \
  -H "Authorization: Bearer $TOKEN"
```

### 4.8 Lấy JWKS Public Keys

Dùng để các service khác xác minh JWT offline:

```bash
curl http://localhost:8081/api/v1/auth/.well-known/jwks.json
```

---

## 5. Tích Hợp Với Các Service Khác

### service-auth → service-gateway
- Gateway gọi `/internal/v1/tokens/verify` để xác minh JWT
- Gateway gọi `/internal/v1/api-keys/verify` để xác minh API key
- Gateway tải JWKS từ `/.well-known/jwks.json` để cache public key

### service-auth → Kafka → Các consumers
- Khi thu hồi API key hoặc user, auth phát sự kiện lên topic `auth-revocation`
- Gateway, Ingestion, Broadcaster lắng nghe topic này để chặn token/key bị thu hồi

### Sơ đồ tích hợp

```
Người dùng → Gateway → service-auth (xác thực)
                ↓
            Gateway cache JWT (offline verify)
                ↓
Admin → auth → Kafka (auth-revocation) → Gateway/Ingestion/Broadcaster (chặn)
```

---

## 6. Giám Sát & Quan Sát

### Health check
```bash
curl http://localhost:8081/actuator/health
```

### Metrics
```bash
curl http://localhost:8081/actuator/prometheus | grep http_server_requests
```

### Chỉ số quan trọng cần theo dõi
- **Số request đăng nhập thất bại:** tăng đột biến → có thể bị brute-force
- **Số API key bị thu hồi:** mỗi lần thu hồi → sự kiện Kafka
- **Latency đăng nhập p95:** nên dưới 200ms

---

## 7. Xử Lý Sự Cố Thường Gặp

### Đăng nhập trả về 403

**Nguyên nhân có thể:**
1. Tài khoản bị khóa do nhập sai mật khẩu 5 lần → Chờ 15 phút hoặc admin bật lại
2. Tài khoản bị admin vô hiệu hóa → Admin dùng `/users/{id}/enable` để kích hoạt lại

### JWKS endpoint trả về rỗng

**Nguyên nhân:** Service mới khởi động, chưa tạo cặp khóa RSA.  
**Xử lý:** Gọi register hoặc login lần đầu → hệ thống tự tạo khóa.

### Flyway migration lỗi

**Xử lý:**
```bash
docker exec tracking-postgres psql -U tracking -d tracking \
  -c "DROP TABLE IF EXISTS flyway_schema_history;"
```
Sau đó khởi động lại service.

### Kafka connection lỗi

**Triệu chứng:** Service khởi động nhưng không phát được sự kiện thu hồi.  
**Xử lý:** Kiểm tra Kafka broker hoạt động và topic `auth-revocation` tồn tại.

---

## 8. Triển Khai

### Docker

```bash
docker build -t tracking/service-auth:latest -f service-auth/Dockerfile .
docker run -p 8081:8081 \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/tracking \
  -e SPRING_KAFKA_BOOTSTRAP_SERVERS=kafka:9092 \
  tracking/service-auth:latest
```

### Kubernetes (Helm)

Service auth được deploy qua Helm chart tại `infrastructure/k8s/helm/tracking-platform/`:

```bash
helm upgrade tracking infrastructure/k8s/helm/tracking-platform \
  -f infrastructure/k8s/environments/prod/values.yaml \
  -n tracking --install
```

Cấu hình prod: 3 replicas, CPU request 500m, memory 512Mi, PDB và HPA bật.
