# Hướng Dẫn Sử Dụng: service-gateway

## 1. Giới Thiệu

**Service-gateway** là cổng vào duy nhất của hệ thống. Tất cả request từ browser, radar, crawler đều phải đi qua gateway trước khi đến các service nội bộ. Gateway xử lý xác thực, giới hạn tốc độ, bảo mật, và định tuyến.

---

## 2. Khởi Động Nhanh

### Yêu cầu
- Java 21
- Redis đang chạy (cho rate limiting)
- Service-auth đang chạy (cho xác thực)
- Kafka đang chạy (cho sự kiện thu hồi)

### Cách chạy

```bash
# 1. Khởi động hạ tầng (PostgreSQL, Redis, Kafka)
docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env.example up -d

# 2. Chạy service-auth trước
./gradlew :service-auth:bootRun --args='--spring.profiles.active=local' &
sleep 10

# 3. Chạy gateway
./gradlew :service-gateway:bootRun --args='--spring.profiles.active=local'
```

### Kiểm tra

```bash
curl -fsS http://localhost:8080/actuator/health
# Kết quả: {"status":"UP"}
```

---

## 3. Cấu Hình

### Biến môi trường chính

| Biến | Mặc định | Giải thích |
|---|---|---|
| `GATEWAY_ROUTE_AUTH_URI` | `http://service-auth:8081` | Địa chỉ service auth |
| `GATEWAY_ROUTE_INGEST_URI` | `http://service-ingestion:8082` | Địa chỉ service ingest |
| `GATEWAY_ROUTE_WS_URI` | `ws://service-broadcaster:8083` | Địa chỉ WebSocket |
| `AUTH_JWKS_URI` | `http://service-auth:8081/.../jwks.json` | Endpoint tải JWKS |
| `AUTH_INTERNAL_API_KEY` | `tracking-internal-key-2026` | Khóa nội bộ. **Phải đổi trên production!** |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka broker |
| `SPRING_DATA_REDIS_HOST` | `localhost` | Redis host cho rate limiting |
| `GATEWAY_ENFORCE_HTTPS` | `false` | Bật chuyển hướng HTTPS |

---

## 4. Bảng Định Tuyến

| Đường dẫn | Đến service | Xác thực | Rate limit |
|---|---|---|---|
| `/api/v1/auth/login` | service-auth | Không | 5 req/s/IP |
| `/api/v1/auth/register` | service-auth | Không | 200 req/s/IP |
| `/api/v1/auth/**` | service-auth | JWT Bearer | 200 req/s/IP |
| `/api/v1/ingest/**` | service-ingestion | API key | 100k req/s/key |
| `/ws/live/**` | service-broadcaster | JWT Bearer | 20 req/s/user |

---

## 5. Cách Sử Dụng

### 5.1 Gọi API qua gateway (thay vì gọi trực tiếp service)

```bash
# Đăng nhập qua gateway
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@12345678"}'

# Gửi dữ liệu radar qua gateway
curl -X POST http://localhost:8080/api/v1/ingest/adsb/batch \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: trk_live_...' \
  -d '{"records": [...]}'

# Kết nối WebSocket qua gateway
wscat -c ws://localhost:8080/ws/live/adsb \
  -H "Authorization: Bearer eyJhbG..."
```

### 5.2 Kiểm tra security headers

```bash
curl -I http://localhost:8080/api/v1/auth/login
# Kết quả bao gồm:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Cache-Control: no-store
```

### 5.3 Kiểm tra JWKS cache

```bash
# Gateway tự cache public key từ auth
# Xem trạng thái tại metrics:
curl http://localhost:8080/actuator/prometheus | grep resilience4j
```

---

## 6. Tích Hợp

### Upstream (Gateway gọi đến)
- **service-auth:** Xác thực JWT, verify API key, tải JWKS
- **service-ingestion:** Chuyển tiếp request ingest
- **service-broadcaster:** Chuyển tiếp WebSocket connection

### Downstream (Gọi đến Gateway)
- **Browser:** Frontend app gọi API qua gateway
- **Radar/Crawler:** Gửi dữ liệu ADS-B qua gateway
- **Kafka:** Gateway lắng nghe `auth-revocation` topic

### Lưu ý quan trọng
> ⚠️ **Không được gọi trực tiếp các service nội bộ** (auth:8081, ingestion:8082, ...) từ bên ngoài. Kubernetes NetworkPolicy chặn truy cập trực tiếp — chỉ gateway được phép nhận traffic công khai.

---

## 7. Giám Sát

### Health check
```bash
curl http://localhost:8080/actuator/health
```

### Metrics quan trọng
```bash
curl http://localhost:8080/actuator/prometheus | grep http_server_requests
curl http://localhost:8080/actuator/prometheus | grep resilience4j_circuitbreaker_state
```

| Chỉ số | Ý nghĩa | Ngưỡng cảnh báo |
|---|---|---|
| `http_server_requests` 5xx rate | Tỷ lệ lỗi server | > 2% |
| `resilience4j_circuitbreaker_state` | Trạng thái CB (`0`=closed, `1`=open) | ≠ 0 |

---

## 8. Xử Lý Sự Cố

### Gateway trả 401 cho request hợp lệ

**Nguyên nhân có thể:**
1. JWKS cache chưa được tải → Kiểm tra auth service đang chạy
2. Token hết hạn → Dùng refresh token để lấy token mới
3. Token/user bị thu hồi → Kiểm tra sự kiện trên topic `auth-revocation`

### Gateway trả 429

**Nguyên nhân:** Rate limit bị vượt.
- Login: > 5 req/s từ cùng IP
- Ingest: > 100k req/s từ cùng API key

**Xử lý:** Kiểm tra Redis hoạt động, xem xét tăng `replenishRate`.

### Gateway trả 413

**Nguyên nhân:** Payload quá lớn.
- Ingest: > 256 KB
- Auth: > 64 KB

### Gateway trả 503

**Nguyên nhân:** Circuit breaker đang mở (downstream service lỗi).

**Xử lý:**
1. Kiểm tra sức khỏe service downstream (auth, ingestion, broadcaster)
2. Xem trạng thái circuit breaker: `curl .../actuator/prometheus | grep resilience4j`
3. Chờ circuit breaker chuyển sang half-open (10 giây cho JWKS, 5 giây cho API key)

### Redis không kết nối được

**Triệu chứng:** Rate limiting không hoạt động, mọi request đều bị cho qua.

**Xử lý:** Kiểm tra Redis container đang chạy và port 6379 mở.

---

## 9. Triển Khai

### Kubernetes

Gateway là service duy nhất có `service.type: LoadBalancer` để nhận traffic công khai.

```yaml
# infrastructure/k8s/environments/prod/values.yaml
gateway:
  service:
    type: LoadBalancer
  replicaCount: 3
  resources:
    requests: { cpu: 500m, memory: 512Mi }
    limits: { cpu: "2", memory: 1Gi }
  pdb:
    enabled: true
  hpa:
    enabled: true
    minReplicas: 3
    maxReplicas: 8
```

NetworkPolicy đảm bảo chỉ gateway nhận traffic công khai, các service khác chỉ nhận traffic nội bộ.
