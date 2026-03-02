# Kế Hoạch Tích Hợp 5 Nguồn Crawler Vào Hệ Thống

**Ngày:** 2026-03-01  
**Phạm vi:** onboard 5 nguồn ADS-B crawler thực tế vào platform tracking hiện tại  
**Database:** giữ nguyên, không đổi schema/migration  
**Mức thay đổi backend:** không cần đổi code backend để onboard baseline 5 nguồn

## 1. Kết luận review

Pipeline hiện tại đã đủ để nhận 5 nguồn crawler:

```text
Crawler -> Gateway -> Ingestion -> Kafka(raw-adsb) -> Processing -> Storage/Broadcaster
```

Nhưng bản plan cũ có vài giả định cần sửa:
1. `X-Source-Id` không phải identity header do crawler tự quyết. Gateway và ingestion sẽ canonicalize `source_id` từ API key đã verify.
2. `429` không chỉ đến từ gateway rate-limit, mà còn có thể đến từ admission control của ingestion.
3. Plan cũ thiếu `503 Service Unavailable` khi Kafka publish timeout/unavailable.
4. Backend hiện chưa enforce chặt `icao=6 hex`, `altitude>=0`, `speed>=0`, `heading in [0,360]`; đó nên là **quy tắc connector tự làm sạch**, không được mô tả như validation runtime đã có.
5. Payload giới hạn là `256 KB`, nên `BATCH_SIZE=1000` chỉ là trần logic; crawler phải chunk theo **cả số records lẫn kích thước payload**.
6. Contract ingest hiện **không hỗ trợ arbitrary metadata pass-through** từ crawler; unknown fields sẽ bị bỏ qua.

Kết luận:
- Có thể tích hợp 5 nguồn ngay với backend hiện tại.
- Việc quan trọng nằm ở connector quality, source normalization, API key isolation và E2E verification.

## 2. Contract ingest thực tế

### 2.1 Endpoint chuẩn

```text
POST http://<gateway>/api/v1/ingest/adsb/batch
```

URL thường dùng:
- Local profile: `http://localhost:8080`
- Docker E2E: `http://localhost:18080`

### 2.2 Headers

| Header | Bắt buộc | Mô tả |
|---|---|---|
| `Content-Type: application/json` | Có | JSON body |
| `x-api-key: trk_live_...` | Có | API key gắn với đúng `sourceId` |
| `x-request-id: ...` | Khuyến nghị | Correlation id để debug/tracing |
| `traceparent: ...` | Khuyến nghị | Distributed trace nếu crawler hỗ trợ |

`X-Source-Id`:
- crawler **không nên** coi đây là header identity do mình tự điều khiển,
- gateway sẽ verify API key rồi inject/canonicalize `X-Source-Id` từ `sourceId` đã cấp,
- ingestion cũng verify và canonicalize lại nếu request đi trực tiếp vào service.

Khuyến nghị:
- connector có thể **không gửi** `X-Source-Id`,
- hoặc nếu gửi thì phải khớp đúng `sourceId` của API key để dễ đọc log,
- nhưng không được dựa vào nó như nguồn sự thật.

### 2.3 Request body

```json
{
  "records": [
    {
      "icao": "A1B2C3",
      "lat": 21.0285,
      "lon": 105.8542,
      "altitude": 11000,
      "speed": 780.0,
      "heading": 45.0,
      "event_time": 1709280000000
    }
  ]
}
```

Ghi chú:
- `source_id` trong body là optional.
- Khi đi qua gateway với API key hợp lệ, `source_id` thực tế downstream sẽ lấy từ API key principal.
- Nếu body có `source_id`, hãy giữ cùng giá trị với `sourceId` được cấp để tránh nhầm khi debug; không dùng body để “đổi danh tính”.

### 2.4 Response

#### Thành công

`202 Accepted`

```json
{
  "accepted": 1
}
```

`accepted` là số records trong batch đã được chấp nhận để publish vào pipeline.

#### Lỗi thường gặp

| Status | Ý nghĩa thực tế |
|---|---|
| `400 Bad Request` | Body bind lỗi hoặc validation lỗi |
| `401 Unauthorized` | API key thiếu, sai, hoặc bị revoke |
| `413 Payload Too Large` | Batch > `1000` records hoặc request body vượt policy size |
| `429 Too Many Requests` | Gateway rate-limit hoặc ingestion admission control |
| `503 Service Unavailable` | Kafka publish timeout / producer unavailable |

## 3. Validation: runtime thực tế vs quy tắc connector nên áp dụng

### 3.1 Runtime hiện tại đang enforce

| Trường | Runtime hiện tại |
|---|---|
| `records` | không được rỗng |
| batch size | tối đa `1000` records |
| `icao` | không được rỗng |
| `lat` | bắt buộc, finite, trong `[-90, 90]` |
| `lon` | bắt buộc, finite, trong `[-180, 180]` |
| `event_time` | bắt buộc, `> 0` |
| `speed` | nếu có thì phải finite |
| `heading` | nếu có thì phải finite |
| `source_id` | phải có ở body hoặc được canonicalize từ header |

### 3.2 Connector bắt buộc nên enforce thêm

Backend hiện **chưa** enforce các quy tắc domain dưới đây, nên crawler phải tự làm sạch:

| Trường | Quy tắc connector nên enforce |
|---|---|
| `icao` | chuẩn hóa uppercase, ưu tiên đúng 6 ký tự hex ICAO 24-bit |
| `altitude` | convert sang feet, không gửi giá trị âm |
| `speed` | convert sang km/h, không gửi giá trị âm |
| `heading` | chuẩn hóa về `0..360` |
| `event_time` | luôn gửi epoch milliseconds theo event time của bản ghi |
| `source_id` | nếu có trong body thì phải khớp `sourceId` đã cấp cho API key |

Điểm quan trọng:
- nếu nguồn gốc dùng `seconds`, connector phải nhân `1000`,
- nếu nguồn gốc dùng `knots`, connector phải nhân `1.852`,
- nếu nguồn gốc dùng `meters`, connector phải nhân `3.28084`.

### 3.3 Metadata bổ sung

Hiện tại ingest contract **không nhận arbitrary metadata** từ crawler để lưu xuống `storage.metadata`.

Điều đó có nghĩa:
- các field lạ trong JSON sẽ bị bỏ qua,
- nếu một nguồn cần lưu provenance/quality flags/vendor fields, phải mở backlog backend riêng thay vì giả định hệ thống đã hỗ trợ.

## 4. Giới hạn vận hành hiện tại

| Tham số | Giá trị hiện tại | Ghi chú |
|---|---|---|
| Batch size tối đa | `1000` records | do ingestion enforce |
| Payload tối đa | `256 KB` | gateway request-size policy |
| In-flight admission | `1024` requests | ingestion admission control |
| Gateway ingest rate-limit | `100000 req/s` / API key | gateway Redis rate limiter |
| Gateway auth/login rate-limit | `5 req/s` / IP | không ảnh hưởng ingest bình thường |

Khuyến nghị triển khai connector:
- không gửi mặc định `1000` records nếu payload có nhiều field hoặc record dài,
- chunk theo cả `record count` lẫn `serialized byte size`,
- đặt `timeout` request chặt, retry có backoff,
- nếu gặp `429` hoặc `503` thì giảm tốc/bật backoff thay vì spam retry tức thì.

## 5. Danh sách 5 nguồn cần onboard

Điền thông tin thật vào bảng này trước khi code connector:

| # | Source ID | Tên nguồn | Cách lấy dữ liệu | Format gốc | Units gốc | Peak rate | Ghi chú mapping |
|---|---|---|---|---|---|---|---|
| 1 | `ADSBX-SNAPSHOT` | ADS-B Exchange globe snapshot | browser automation + JS fetch nội bộ | zstd + binCraft binary | cần tự xác minh từng field | phụ thuộc kích thước snapshot | xem [adsbx-source-profile.md](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/docs/adsbx-source-profile.md) |
| 2 | `FR24-GLOBAL` | Flightradar24 zone collector | HTTP JSON feed theo nhiều zone | JSON array per aircraft | altitude=feet, speed=knots, timestamp=seconds | phụ thuộc số zone và overlap | xem [fr24-source-profile.md](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/docs/fr24-source-profile.md) |
| 3 | `RADARBOX-GLOBAL` | RadarBox / AirNav gRPC-web collector | HTTP gRPC-web protobuf | protobuf over grpc-web | altitude=feet, speed=knots?, timestamp=milliseconds | phụ thuộc upstream response size | xem [radarbox-source-profile.md](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/docs/radarbox-source-profile.md) |
| 4 | `CRAWLER-4` | | | | | | |
| 5 | `CRAWLER-5` | | | | | | |

Tối thiểu phải biết cho mỗi nguồn:
- trường nào map sang `icao`,
- timestamp là giây hay milliseconds,
- `lat/lon` có đúng WGS84 decimal degrees không,
- altitude là feet hay meters,
- speed là km/h, knots hay m/s,
- throughput đỉnh,
- dữ liệu có duplicate hoặc out-of-order nhiều không.

## 6. Quy trình triển khai

### Bước 1: cấp API key cho từng nguồn

Lưu ý:
- local profile của `service-auth` đang bật bootstrap admin mặc định `admin / Admin@12345678`,
- môi trường khác có thể không dùng credential này; phải dùng admin thực của môi trường.

```bash
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@12345678}"

TOKEN=$(
  curl -s -X POST "${GATEWAY_URL}/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${ADMIN_USERNAME}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
  | jq -r .accessToken
)

for SOURCE_ID in ADSBX-SNAPSHOT FR24-GLOBAL RADARBOX-GLOBAL CRAWLER-4 CRAWLER-5; do
  curl -s -X POST "${GATEWAY_URL}/api/v1/auth/api-keys" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "{\"sourceId\":\"${SOURCE_ID}\"}" | jq .
done
```

Lưu lại:
- `sourceId`
- `apiKey`
- ai sở hữu nguồn này
- endpoint crawler
- ngày cấp / ngày rotate

### Bước 2: viết connector cho từng nguồn

Yêu cầu tối thiểu của connector:
1. crawl/pull nguồn gốc,
2. normalize units,
3. validate domain tại connector,
4. chunk theo count + bytes,
5. gửi đến gateway với `x-api-key`,
6. log `x-request-id` / batch size / status code / latency.

Pseudo-flow khuyến nghị:

```python
def normalize_record(raw):
    icao = str(raw["icao"]).strip().upper()
    lat = float(raw["lat"])
    lon = float(raw["lon"])
    event_time = normalize_event_time(raw["timestamp"])
    altitude = normalize_altitude_to_feet(raw.get("altitude"))
    speed = normalize_speed_to_kmh(raw.get("speed"))
    heading = normalize_heading(raw.get("heading"))

    if len(icao) != 6:
        return None
    if not (-90 <= lat <= 90):
        return None
    if not (-180 <= lon <= 180):
        return None
    if event_time <= 0:
        return None

    record = {
        "icao": icao,
        "lat": lat,
        "lon": lon,
        "event_time": event_time,
    }
    if altitude is not None:
        record["altitude"] = altitude
    if speed is not None:
        record["speed"] = speed
    if heading is not None:
        record["heading"] = heading
    return record
```

### Bước 3: chunk an toàn theo size

Không dùng duy nhất `BATCH_SIZE=1000`.

Khuyến nghị:
- `MAX_RECORDS_PER_BATCH = 1000`
- `TARGET_PAYLOAD_BYTES = 220 * 1024`

Lý do:
- gateway chặn ở `256 KB`,
- cần chừa headroom cho JSON wrapper + headers + dao động kích thước record.

### Bước 4: retry policy ở connector

| Status | Hành động khuyến nghị |
|---|---|
| `202` | log success |
| `400` | drop batch, log sample payload lỗi, sửa transform |
| `401` | dừng connector, cảnh báo vì key sai/revoked |
| `413` | giảm chunk size ngay |
| `429` | exponential backoff + jitter, giảm request rate |
| `503` | exponential backoff + retry giới hạn |

## 7. Checklist mapping cho từng nguồn

| # | Câu hỏi | Bắt buộc xử lý |
|---|---|---|
| 1 | Trường nào là ICAO 24-bit address? | map đúng sang `icao` |
| 2 | Tọa độ có phải WGS84 decimal degrees không? | nếu không, convert trước khi gửi |
| 3 | Altitude đang là feet hay meters? | convert sang feet |
| 4 | Speed đang là km/h, knots hay m/s? | convert sang km/h |
| 5 | Timestamp là seconds hay milliseconds? | convert sang epoch ms |
| 6 | Có thể duplicate/out-of-order không? | ghi chú để theo dõi dedup/historical behavior |
| 7 | Có trường vendor-specific cần giữ lại không? | hiện chưa hỗ trợ passthrough metadata |
| 8 | Peak records/s và burst size là bao nhiêu? | dùng để chỉnh pacing/chunking |

## 8. Kiểm tra E2E cho từng nguồn

### 8.1 Smoke ingest

Dùng payload tối thiểu nhưng hợp lệ:

```bash
curl -s -X POST "${GATEWAY_URL}/api/v1/ingest/adsb/batch" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -H "x-request-id: smoke-${SOURCE_ID}-$(date +%s)" \
  -d '{
    "records": [
      {
        "icao": "ABC123",
        "lat": 21.0285,
        "lon": 105.8542,
        "event_time": '"$(date +%s%3N)"'
      }
    ]
  }' | jq .
```

Mong đợi:
- HTTP `202`
- response body có `accepted = 1`

### 8.2 Verify Kafka raw topic

Không dùng `--from-beginning` vì dễ đọc nhầm dữ liệu cũ.

Ví dụ:

```bash
docker exec tracking-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic raw-adsb \
  --max-messages 5 \
  --timeout-ms 5000
```

Nếu cần kiểm chính xác hơn:
- gửi batch smoke trước,
- thêm `x-request-id`,
- đối chiếu tiếp ở log/metrics/DB theo thời gian gửi.

### 8.3 Verify storage

```bash
docker exec tracking-postgres psql -U tracking -d tracking -c \
  "SELECT icao, lat, lon, event_time, source_id, request_id
   FROM storage.flight_positions
   WHERE source_id = '${SOURCE_ID}'
   ORDER BY event_time DESC
   LIMIT 5;"
```

Kỳ vọng:
- `source_id` đúng với source đã cấp API key,
- record xuất hiện sau vài giây,
- không có dữ liệu sai unit/range bất thường.

### 8.4 Verify UI/WebSocket

Điều kiện:
1. đăng nhập frontend bằng user hợp lệ,
2. map đang mở đúng viewport,
3. dữ liệu là realtime, không quá cũ.

Nếu record vào DB nhưng không hiện trên UI, kiểm tra:
- `event_time` có quá cũ nên bị route historical không,
- viewport có bao trùm vị trí record không,
- user đã đăng nhập để mở WS chưa.

## 9. Chạy đồng thời 5 nguồn

Cho môi trường dev/smoke có thể chạy 5 process riêng. Nhưng cho go-live nên dùng:
- systemd,
- Docker Compose riêng cho connectors,
- hoặc supervisor tương đương.

Không nên dựa vào 5 terminal nền `&` như cách chạy chính thức.

Tối thiểu mỗi connector phải có:
- restart policy,
- log rotation,
- env file riêng,
- metric/log đủ để biết nguồn nào đang lỗi.

## 10. Giám sát sau go-live

### 10.1 Metrics quan trọng

```bash
curl -s http://localhost:8082/actuator/prometheus | grep tracking_ingestion_
curl -s http://localhost:8084/actuator/prometheus | grep tracking_storage_
```

Các metric nên theo dõi:
- `tracking_ingestion_accepted_batch_records_total`
- `tracking_ingestion_kafka_published_total`
- `tracking_ingestion_rejected_auth_total`
- `tracking_ingestion_rejected_admission_total`
- `tracking_ingestion_rejected_producer_unavailable_total`
- `tracking_ingestion_rejected_validation_total`
- `tracking_storage_buffer_size`
- `tracking_storage_batch_failed_total`
- `tracking_storage_rows_written_total`

### 10.2 SQL kiểm tra nhanh theo nguồn

```bash
docker exec tracking-postgres psql -U tracking -d tracking -c \
  "SELECT source_id, COUNT(*) AS rows_written, MIN(event_time), MAX(event_time)
   FROM storage.flight_positions
   WHERE event_time > now() - interval '1 hour'
   GROUP BY source_id
   ORDER BY rows_written DESC;"
```

## 11. Checklist triển khai

| # | Nguồn | API key | Connector | Normalize units | Byte-aware chunking | E2E pass | DB verify | UI verify | Go-live |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `ADSBX-SNAPSHOT` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 2 | `FR24-GLOBAL` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3 | `RADARBOX-GLOBAL` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4 | `CRAWLER-4` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 5 | `CRAWLER-5` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

## 12. Lỗi thường gặp

| Lỗi | Nguyên nhân thực tế | Cách xử lý |
|---|---|---|
| `401 Unauthorized` | thiếu API key, key sai, key bị revoke | kiểm tra key, revoke state, source binding |
| `400 Bad Request` | `records` rỗng, body lỗi JSON, thiếu trường bắt buộc, lat/lon out of range | fix transform và payload |
| `413 Payload Too Large` | vượt `1000` records hoặc > `256 KB` | giảm cả số record lẫn payload bytes |
| `429 Too Many Requests` | gateway rate-limit hoặc ingestion admission reject | giảm tốc, thêm backoff, giảm concurrency |
| `503 Service Unavailable` | Kafka publish timeout/unavailable | retry có backoff, kiểm tra Kafka/ingestion |
| Dữ liệu vào DB nhưng không hiện frontend | record historical, không đúng viewport, chưa login WS | kiểm tra `event_time`, viewport, JWT |
| `source_id` trong DB không như mong đợi | API key đang gắn với source khác | kiểm tra source binding của API key |
| Altitude/speed sai | connector chưa convert units | fix mapping ở connector |
| Vendor fields mất | ingest chưa hỗ trợ metadata passthrough | mở backlog backend riêng |

## 13. Khuyến nghị cuối

Để onboard 5 nguồn an toàn, thứ tự đúng là:
1. chốt inventory từng nguồn và mapping units,
2. cấp API key riêng cho từng nguồn,
3. viết connector có normalization + byte-aware batching,
4. smoke test từng nguồn độc lập,
5. chạy đồng thời 5 nguồn,
6. theo dõi metrics và DB verify trong giờ đầu go-live.

Backend hiện tại đủ để nhận 5 nguồn. Điểm quyết định thành công nằm ở:
- chất lượng connector,
- phân tách API key theo nguồn,
- pacing/retry đúng,
- và xác minh E2E theo `source_id` thật.
