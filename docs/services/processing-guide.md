# Hướng Dẫn Sử Dụng: service-processing

## 1. Giới Thiệu

**Service-processing** xử lý dữ liệu bay thô từ Kafka, loại bản ghi trùng/không hợp lệ, làm giàu thông tin (quốc gia, ảnh máy bay), và phân loại thành dữ liệu realtime hoặc historical.

---

## 2. Khởi Động Nhanh

```bash
# Yêu cầu: Kafka, Redis đang chạy
./gradlew :service-processing:bootRun --args='--spring.profiles.active=local'

# Kiểm tra
curl http://localhost:8085/actuator/health
```

---

## 3. Cách Hoạt Động

Processing **không có HTTP API** cho client bên ngoài. Nó là service nội bộ, tự động:

1. **Đọc** bản ghi từ Kafka topic `raw-adsb`
2. **Xử lý** qua pipeline 6 bước: dedup → kinematic → event time → enrich → state fusion → routing
3. **Ghi** kết quả ra:
   - `live-adsb` — dữ liệu realtime (event_time ≤ 30 giây trước)
   - `historical-adsb` — dữ liệu lịch sử
   - `adsb-dlq` — bản ghi lỗi (tốc độ > 1200 km/h, v.v.)

---

## 4. Cấu Hình

| Biến | Mặc định | Giải thích |
|---|---|---|
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka broker |
| `SPRING_DATA_REDIS_HOST` | `localhost` | Redis cho dedup cache |

---

## 5. Giám Sát

```bash
curl http://localhost:8085/actuator/prometheus | grep tracking_processing
```

| Metric | Cần theo dõi |
|---|---|
| `tracking_processing_pipeline_latency_seconds` | p95 nên < 200ms |
| `tracking_processing_published_dlq_total` | Nên < 0.1% tổng |
| `tracking_processing_pipeline_dropped_duplicate_total` | Tăng → dữ liệu nguồn bị trùng |

---

## 6. Xử Lý Sự Cố

### DLQ rate cao

**Nguyên nhân:** Nhiều bản ghi bị kinematic reject (tốc độ > 1200 km/h).
**Xử lý:** Kiểm tra nguồn radar gửi dữ liệu sai, hoặc điều chỉnh ngưỡng nếu cần.

### Pipeline latency cao

**Nguyên nhân:** Redis chậm (dedup), hoặc Kafka consumer lag.
**Xử lý:** Kiểm tra Redis performance, tăng consumer partitions, hoặc scale thêm replicas.

### No data published

**Nguyên nhân:** Kafka consumer không nhận được message từ `raw-adsb`.
**Xử lý:** Kiểm tra topic `raw-adsb` tồn tại, service-ingestion đang publish.

---

## 7. Triển Khai

```yaml
processing:
  replicaCount: 4
  resources:
    requests: { cpu: "1", memory: 1Gi }
    limits: { cpu: "4", memory: 2Gi }
```
