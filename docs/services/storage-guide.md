# Hướng Dẫn Sử Dụng: service-storage

## 1. Giới Thiệu

`service-storage` đọc dữ liệu bay đã xử lý từ Kafka (`live-adsb`, `historical-adsb`), buffer trong bộ nhớ và ghi batch vào PostgreSQL/TimescaleDB.

Đây là service **write-focused**:
- không expose API query lịch sử cho client,
- tối ưu cho persist ổn định, idempotent và replay-safe,
- phù hợp với recent history theo `icao`, chưa phải query layer cuối cho analytics/spatial search.

## 2. Khởi Động Nhanh

```bash
# Yêu cầu: TimescaleDB và Kafka đang chạy
./gradlew :service-storage:bootRun --args='--spring.profiles.active=local'

# Kiểm tra health
curl http://localhost:8084/actuator/health
```

## 3. Kiểm tra dữ liệu đã ghi

```bash
# Kết nối database
docker exec -it tracking-postgres psql -U tracking -d tracking

# Đếm bản ghi
SELECT COUNT(*) FROM storage.flight_positions;

# Xem 10 bản ghi gần nhất
SELECT icao, lat, lon, speed, event_time, source_id, is_historical
FROM storage.flight_positions
ORDER BY event_time DESC
LIMIT 10;

# Đếm theo source trong 1 giờ gần nhất
SELECT source_id, COUNT(*)
FROM storage.flight_positions
WHERE event_time >= now() - interval '1 hour'
GROUP BY source_id
ORDER BY count DESC;
```

## 4. Cấu Hình Runtime Chính

| Key | Mặc định | Ghi chú |
|---|---|---|
| `SERVER_PORT` | `8084` | Port local profile |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/tracking` | JDBC URL |
| `TRACKING_KAFKA_BOOTSTRAP_SERVERS` | `localhost:29092` ở local profile | Kafka bootstrap servers |
| `tracking.storage.consumer.concurrency` | `4` | Số Kafka consumer threads |
| `tracking.storage.batch.max-size` | `5000` | Kích thước batch ghi DB |
| `tracking.storage.batch.flush-interval-millis` | `5000` | Flush theo thời gian |
| `tracking.storage.buffer.max-capacity` | `100000` | Buffer giới hạn để tránh OOM |
| `tracking.storage.buffer.pause-threshold` | `90000` | Mốc pause consumer |
| `tracking.storage.buffer.resume-threshold` | `50000` | Mốc resume consumer |

## 5. Database Model

`storage.flight_positions` hiện có các cột quan trọng:
- `icao`
- `event_time`
- `lat`, `lon`
- `altitude`, `speed`, `heading`
- `source_id`
- `is_historical`
- `metadata`
- `request_id`
- `traceparent`
- `created_at`

Tính chất chính:
- hypertable theo `event_time`,
- unique dedup key `(icao, event_time, lat, lon)`,
- batch insert dùng `ON CONFLICT DO NOTHING`,
- compression sau `7 ngày`,
- retention raw hiện tại `90 ngày`.

## 6. Giám Sát

```bash
curl http://localhost:8084/actuator/prometheus | grep tracking_storage
```

Các tín hiệu quan trọng:

| Metric | Ý nghĩa | Gợi ý cảnh báo |
|---|---|---|
| `tracking_storage_buffer_size` | Số record đang chờ persist | cảnh báo khi buffer tăng liên tục hoặc tiến gần `pause-threshold` |
| `tracking_storage_batch_failed_total` | Batch persist lỗi sau retry | phải điều tra ngay nếu > 0 |
| `tracking_storage_rows_written_total` | Tổng rows đã ghi | dùng để đối chiếu ingest vs persist |
| `tracking_storage_batch_latency_seconds` | Latency mỗi batch | theo dõi p95/p99 |
| `tracking_storage_dlq_published_total` | Batch bị đẩy DLQ | không nên tăng trong trạng thái bình thường |

## 7. Xử Lý Sự Cố

### Buffer tăng liên tục

Nguyên nhân thường gặp:
1. DB chậm hoặc lock nhiều,
2. batch size/flush interval không phù hợp,
3. downstream storage không theo kịp ingest rate.

Checklist:
1. Kiểm tra `tracking_storage_buffer_size` và `tracking_storage_batch_latency_seconds`.
2. Kiểm tra disk, IOPS, autovacuum, active locks trên PostgreSQL.
3. Kiểm tra chunk growth và compression lag bằng [storage-baseline.sql](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/infra/postgres/storage-baseline.sql).

### Batch failures

Nguyên nhân thường gặp:
1. DB unavailable,
2. schema drift,
3. disk full,
4. connection pool exhaustion.

Checklist:
1. Xem log `service-storage`.
2. Kiểm tra health PostgreSQL và bảng `flyway_schema_history_storage`.
3. Kiểm tra `quarantine_records` và topic `storage-dlq`.

### Duplicate records

Retry bình thường **không** tạo duplicate rows vì DB đã chặn bằng unique index + `ON CONFLICT DO NOTHING`.

## 8. Sao Lưu Và Khôi Phục

Xem chi tiết tại [backup-restore.md](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/infra/postgres/backup-restore.md).

Lưu ý:
- backup/restore hiện tập trung vào DB operational safety,
- chưa phải archive path dài hạn cho cold historical analytics,
- thay đổi retention raw chỉ nên làm sau khi archive path được verify riêng.

## 9. Giới Hạn Hiện Tại

Service hiện tại mạnh ở:
- persist throughput cao,
- idempotent storage,
- recent history theo `icao`.

Service hiện tại chưa phải tầng query tối ưu cho:
- spatial search thật,
- metadata filtering nặng,
- analytics cross-ICAO trên dữ liệu thô rất lớn,
- historical replay dài hạn trên quy mô lớn.

Những nhu cầu đó thuộc roadmap trong [storage-improvement-plan.md](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/docs/storage-improvement-plan.md).
