# Hướng Dẫn Sử Dụng: service-ingestion

## 1. Giới Thiệu

**Service-ingestion** nhận dữ liệu bay ADS-B từ nguồn radar/crawler. Đây là điểm tiếp nhận dữ liệu chính của hệ thống — nhận batch payload qua HTTP, validate, rồi đẩy vào Kafka.

---

## 2. Khởi Động Nhanh

```bash
# Yêu cầu: PostgreSQL, Kafka, service-auth đang chạy
./gradlew :service-ingestion:bootRun --args='--spring.profiles.active=local'

# Kiểm tra
curl http://localhost:8082/actuator/health
```

---

## 3. Gửi Dữ Liệu

### Gửi qua Gateway (khuyến nghị)

```bash
curl -X POST http://localhost:8080/api/v1/ingest/adsb/batch \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: trk_live_...' \
  -H 'X-Source-Id: RADAR-HN' \
  -d '{
    "records": [
      {
        "icao": "A1B2C3",
        "lat": 21.0285,
        "lon": 105.8542,
        "altitude": 11000,
        "speed": 780,
        "heading": 45,
        "event_time": 1709280000000,
        "source_id": "RADAR-HN"
      }
    ]
  }'
```

**Kết quả thành công:** `HTTP 202 Accepted`

### Batch lớn

Gửi tối đa **1000 bản ghi** mỗi batch. Nếu vượt → `413 Payload Too Large`.

---

## 4. Cấu Hình

| Biến | Mặc định | Giải thích |
|---|---|---|
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka broker |
| `AUTH_SERVICE_BASE_URL` | `http://service-auth:8081` | Auth service |
| `AUTH_INTERNAL_API_KEY` | `tracking-internal-key-2026` | Khóa nội bộ |

---

## 5. Giám Sát

### Metrics quan trọng

```bash
curl http://localhost:8082/actuator/prometheus | grep tracking_ingestion
```

| Metric | Ý nghĩa |
|---|---|
| `tracking_ingestion_accepted_batch_records_total` | Bản ghi được chấp nhận |
| `tracking_ingestion_rejected_producer_unavailable_total` | Kafka producer lỗi → cần kiểm tra Kafka |
| `tracking_ingestion_rejected_admission_total` | Quá tải → cần scale hoặc giảm tải |

---

## 6. Xử Lý Sự Cố

### `429 Too Many Requests`
**Nguyên nhân:** Hệ thống đang quá tải (backpressure).
**Xử lý:** Giảm tốc độ gửi hoặc scale thêm instance ingestion.

### `503 Service Unavailable`
**Nguyên nhân:** Kafka producer không kết nối được broker.
**Xử lý:** Kiểm tra Kafka broker health, disk space.

### `401 Unauthorized`
**Nguyên nhân:** API key không hợp lệ hoặc đã bị thu hồi.
**Xử lý:** Liên hệ admin để kiểm tra và cấp API key mới.

### `400 Bad Request`
**Nguyên nhân:** Dữ liệu không đúng format.
**Xử lý:** Kiểm tra ICAO (6 hex), lat (-90~90), lon (-180~180), speed ≥ 0.

---

## 7. Triển Khai

Kubernetes: 2-4 replicas, `terminationGracePeriodSeconds: 30` để flush Kafka producer khi shutdown.

```yaml
ingestion:
  replicaCount: 4
  terminationGracePeriodSeconds: 30
  resources:
    requests: { cpu: "1", memory: 1Gi }
    limits: { cpu: "4", memory: 2Gi }
```
