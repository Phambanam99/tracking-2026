# Storage Improvement Plan v2

**Ngày:** 2026-03-01
**Vai trò review:** Data analyst + senior engineer
**Phạm vi:** `service-storage`, TimescaleDB lifecycle, query path, retention, archive, read scale

## 1. Kết luận điều hành

Storage hiện tại đang đúng hướng cho bài toán ingest realtime:
- Write path đã được harden và chứng minh chạy ổn ở tải cao.
- Mô hình `Kafka -> bounded buffer -> JDBC batch -> TimescaleDB` là hợp lý cho dữ liệu vị trí bất biến.
- Chính sách `ON CONFLICT DO NOTHING` giúp replay-safe và giữ idempotency tốt.

Nhưng plan cũ đang nhảy hơi sớm sang các thay đổi nặng:
- `PostGIS`
- `GIN(metadata)`
- `read replica`
- archive `CSV -> pandas -> parquet`

Các thay đổi đó không sai về ý tưởng, nhưng nếu làm ngay sẽ có 3 rủi ro:
1. tăng write amplification trên đường ghi đang là đường sống của hệ thống,
2. thêm migration/backfill lớn khi chưa có query inventory thật,
3. tối ưu sai lớp dữ liệu vì chưa tách rõ hot read, analytics read và archival read.

Kết luận ngắn:
- **Hiện tại storage đủ tốt cho realtime persist + recent history theo ICAO.**
- **Chưa nên coi đây là kiến trúc cuối cho truy vấn lịch sử dài hạn hoặc spatial analytics nặng.**
- **Roadmap đúng phải là: đo workload thật -> tối ưu query thấp rủi ro -> tạo read model/aggregate -> tiering/archive -> tách query service -> spatial/search nâng cao.**

## 2. Trạng thái hiện tại đã kiểm chứng

| Hạng mục | Trạng thái hiện tại | Nguồn xác nhận |
|---|---|---|
| Hypertable | `flight_positions` hypertable theo `event_time` | `V1__flight_positions.sql` |
| Chunk interval | `1 day` | `V1__flight_positions.sql` |
| Chỉ mục chính | `(icao, event_time DESC)` | `V1__flight_positions.sql` |
| Chỉ mục spatial hiện tại | btree `(lat, lon)` | `V1__flight_positions.sql` |
| Idempotency | unique `(icao, event_time, lat, lon)` + `ON CONFLICT DO NOTHING` | `V2__flight_positions_constraints.sql`, `JdbcBatchWriter.kt` |
| Compression | sau `7 days` | `V4__flight_positions_policies.sql` |
| Retention raw | `90 days` | `V4__flight_positions_policies.sql` |
| Batch write | `5000` rows | `application.yml` |
| Flush interval | `5000ms` | `application.yml` |
| Buffer max | `100000` | `application.yml` |
| Pause / resume | `90000 / 50000` | `application.yml` |
| Consumer concurrency | `4` | `application.yml` |

Ý nghĩa thực tế:
- Tối ưu tốt cho `WHERE icao = ? AND event_time BETWEEN ...`.
- Tối ưu khá cho recent range queries có time filter rõ.
- Chưa tối ưu cho:
  - spatial search thật,
  - metadata filtering,
  - cross-ICAO analytics,
  - historical replay dài ngày cho nhiều máy bay cùng lúc.

## 3. Những điểm cần sửa trong plan cũ

### 3.1 `70k-100k msg/s` không nên bị hiểu là lưu raw 24/7 vô hạn

Kết quả load test hiện tại chứng minh được **throughput envelope** của pipeline, không tự động suy ra rằng:
- một node TimescaleDB,
- với full raw retention,
- sẽ giữ ổn định hàng chục đến hàng trăm tỷ rows trong thời gian dài

mà không cần chiến lược lifecycle riêng.

Vì vậy mọi dự báo dung lượng trong plan phải được hiểu là **ước lượng định hướng**, không phải commitment vận hành.

### 3.2 `set_chunk_time_interval(..., '6 hours')` không phải thuốc chữa bách bệnh

Giảm chunk từ `1 day` xuống `6 hours` có thể giúp:
- compress/vacuum dễ hơn,
- chunk pruning chi tiết hơn,
- giảm blast radius khi thao tác trên chunk.

Nhưng nó cũng có chi phí:
- tăng số chunk phải quản lý,
- tăng metadata overhead,
- có thể không giúp gì nhiều nếu query pattern vẫn tệ.

Quyết định này phải benchmark dựa trên:
- rows/chunk thật,
- query latency theo hot path,
- compression lag,
- autovacuum/runtime stats.

### 3.3 Continuous aggregate theo `(bucket, icao, source_id)` chưa chắc đã giảm đủ cardinality

Nếu mục tiêu là analytics dashboard hoặc operational reporting, aggregate theo cả `icao` và `source_id` có thể vẫn quá lớn.

Nguyên tắc:
- aggregate chỉ có giá trị khi cardinality giảm rõ rệt so với raw,
- nếu aggregate gần bằng raw thì bạn đang trả chi phí refresh nhưng không tiết kiệm query cost bao nhiêu.

Phải chọn aggregate theo endpoint thật:
- dashboard theo `source_id`
- report theo ngày/nguồn/quốc gia
- replay theo `icao`

không gom một view cố “phục vụ mọi thứ”.

### 3.4 GIN index trên `metadata` là thay đổi đắt đỏ

`GIN(metadata jsonb_path_ops)` hợp lý khi:
- metadata query là use case thật,
- key set đủ ổn định,
- write overhead chấp nhận được.

Nếu chưa có query inventory rõ ràng, ưu tiên:
- typed columns cho field nóng,
- hoặc targeted expression index,
- thay vì index cả JSONB blob.

### 3.5 PostGIS đúng hướng, nhưng backfill toàn bảng là rủi ro lớn

`ALTER TABLE + UPDATE toàn bộ geom` trên bảng lớn là thao tác nguy hiểm:
- lock kéo dài,
- WAL bùng nổ,
- replica lag,
- IO spike,
- runtime regression.

Nếu cần spatial thật, phải làm theo một trong các hướng:
1. chỉ thêm cho dữ liệu mới trước,
2. backfill chunk-by-chunk ngoài giờ cao điểm,
3. hoặc tạo read-model riêng cho spatial thay vì đụng ngay raw hypertable.

### 3.6 Archive job `psql -> pandas -> parquet` chưa đạt chuẩn production

Nhược điểm:
- không stream-safe,
- phụ thuộc RAM,
- không idempotent,
- không có manifest/checksum,
- không có bước verify rồi mới xóa raw.

Archive production phải có:
- partition path chuẩn theo ngày,
- manifest table,
- row-count/checksum validation,
- trạng thái `pending -> exported -> verified -> deletable`,
- và retry/replay rõ ràng.

### 3.7 “Read replica” trong plan cũ đang bị đơn giản hóa quá mức

Read replica chỉ có ý nghĩa khi:
- query workload đã đủ lớn,
- cần tách read khỏi write,
- đội vận hành chấp nhận complexity của replication lag, failover, backup chain.

Không nên đưa replica thành “quick win”.

## 4. Góc nhìn data analyst: query classes và SLA cần chốt trước

Trước khi thêm index/view/service mới, phải chốt query classes. Đây là bộ khung hợp lý cho product hiện tại:

| Query class | Ví dụ | Dữ liệu phù hợp | SLA khuyến nghị |
|---|---|---|---|
| Recent flight history | 1 ICAO trong 15m-24h gần nhất | raw hot data | p95 < 300ms |
| Operational source monitoring | số điểm nhận theo `source_id` 1m/1h/1d | aggregate | p95 < 500ms |
| Historical replay | 1 ICAO trong 7-30 ngày | raw compressed hoặc track aggregate | p95 < 2s |
| Fleet/report analytics | theo ngày/nguồn/quốc gia | aggregate | p95 < 2s |
| Spatial search | bbox/radius theo thời gian | read model spatial | p95 < 1s cho cửa sổ hẹp |

Nếu product không có endpoint cụ thể cho query class nào, **không tối ưu trước** cho query class đó.

## 5. Roadmap cải thiện đề xuất

### Phase 0: Measurement First

Mục tiêu:
- biến bài toán storage từ cảm tính sang định lượng,
- biết chính xác dung lượng, rows/chunk, compression ratio, growth/day và slow query class.

Deliverables:
- query inventory
- SLA matrix
- sizing baseline
- chunk/compression baseline
- top SQL patterns cần tối ưu

Nên làm ngay:
1. thêm script baseline đo size/chunk/growth,
2. bổ sung tài liệu storage guide/technical cho đúng runtime hiện tại,
3. gắn metric và dashboard cho storage growth/compression lag nếu chưa có.

Acceptance criteria:
- có file baseline SQL chạy được trên TimescaleDB hiện tại,
- có bảng query classes và SLA mục tiêu,
- có số liệu bytes/row, rows/day, chunk count, size growth thực tế.

### Phase 1: Low-risk Query Wins

Chỉ làm sau Phase 0.

Ứng viên hợp lý:
1. **BRIN index trên `event_time`** cho cross-ICAO recent scans.
2. **B-tree `(source_id, event_time DESC)`** nếu operational queries theo source xuất hiện thường xuyên.
3. review lại chunk interval nếu measurement chứng minh `1 day` đang quá lớn cho maintenance/query.

Không nên làm mặc định:
- GIN toàn bộ `metadata`
- PostGIS trên raw table

Acceptance criteria:
- query p95 giảm rõ với query class mục tiêu,
- ingest throughput không giảm ngoài ngưỡng chấp nhận,
- write amplification và disk growth được đo lại sau migration.

### Phase 2: Read Models / Continuous Aggregates

Mục tiêu:
- tách analytics/reporting khỏi raw scan,
- giảm chi phí truy vấn lặp lại.

Nguyên tắc thiết kế:
- mỗi aggregate phục vụ một nhóm endpoint cụ thể,
- cardinality phải giảm rõ,
- không tạo aggregate “vừa replay vừa analytics vừa spatial”.

Các read model nên cân nhắc:
1. `source_activity_1m`
   - key: `bucket, source_id`
   - dùng cho monitoring nguồn.
2. `traffic_daily_1d`
   - key: `bucket, source_id` hoặc `bucket, country`
   - dùng cho báo cáo.
3. `flight_track_1m`
   - key: `bucket, icao`
   - chỉ tạo nếu product thật sự cần replay xa hơn hot retention.

Acceptance criteria:
- dashboard/report không còn quét raw table,
- refresh lag của aggregate được đo và alert hóa,
- chi phí storage của aggregate thấp hơn nhiều so với raw.

### Phase 3: Hot / Warm / Cold Lifecycle

Mục tiêu:
- biến raw storage từ “giữ tất cả càng lâu càng tốt” thành lifecycle có kiểm soát.

Đề xuất đích đến:
- **Hot:** raw chưa nén, `0-7 ngày`
- **Warm:** raw nén, `7-30 ngày`
- **Cold:** aggregate hoặc replay model, `30-365 ngày`
- **Archive:** object storage, raw parquet sau khi verify

Quan trọng:
- không đổi retention từ `90 ngày` xuống `30 ngày` trước khi archive path có kiểm chứng thật,
- delete chỉ sau khi export thành công và verify row count/checksum.

Acceptance criteria:
- archive job có manifest và trạng thái,
- restore thử được từ archive cho 1 ngày dữ liệu,
- retention raw mới chỉ được bật sau khi restore drill pass.

### Phase 4: Query / Read Separation

Chỉ nên tách `service-query` khi có một trong các dấu hiệu:
- query QPS bắt đầu ảnh hưởng write path,
- cần API read riêng biệt cho historical analytics,
- cần cache/authorization/read model khác với storage writer.

Thiết kế đúng:
- `service-storage`: write only
- `service-query`: read only
- DB read path có thể đi qua primary hoặc replica tùy workload

Acceptance criteria:
- endpoint read không chạm vào write worker,
- read SLA ổn định khi write peak,
- auth/filtering/audit cho historical APIs được xác định rõ.

### Phase 5: Spatial Search

Chỉ làm khi product có yêu cầu thật:
- historical bbox search,
- radius search,
- airspace heatmap,
- replay theo khu vực.

Thiết kế khuyến nghị:
- ưu tiên spatial trên read model hoặc hot window trước,
- thêm `geom` cho dữ liệu mới,
- backfill chunk-by-chunk nếu thật sự cần dữ liệu cũ.

Acceptance criteria:
- spatial query có benchmark thật,
- migration/backfill không gây regression write path,
- query plan dùng index `GiST`/`SP-GiST` rõ ràng.

### Phase 6: Read Scale-out và dài hạn ngoài single-node

Nếu product đi tới mức:
- raw high-rate chạy 24/7,
- retention dài,
- analytics lịch sử nặng,

thì single-node TimescaleDB không còn là câu trả lời cuối.

Khi đó cần đánh giá:
- managed read replica,
- dedicated query store,
- object storage + parquet + batch analytics,
- hoặc kiến trúc lakehouse/offline analytics cho tầng historical sâu.

## 6. Việc nên làm ngay cho project

### 6.1 Cập nhật tài liệu storage cho đúng với code hiện tại

Hai tài liệu hiện đang stale:
- `docs/services/storage-guide.md`
- `docs/services/storage-technical.md`

Chúng cần phản ánh đúng:
- batch size `5000`
- flush `5000ms`
- buffer `100000`
- schema thật (`metadata`, `request_id`, `traceparent`)
- compression/retention hiện tại
- giới hạn của read/query path

### 6.2 Thêm baseline SQL script vào repo

Repo nên có script chuẩn để đội dev/ops đo:
- table size
- estimated rows
- rows/day
- chunk inventory
- compression status
- bytes/row estimate

Điều này giúp mọi quyết định P11 không còn dựa trên suy đoán.

### 6.3 Bổ sung backlog riêng cho storage scalability

P6 đã hoàn thành write path. Cần một phase riêng tiếp theo cho:
- query inventory,
- read optimization,
- aggregate,
- archive,
- service-query,
- spatial search,
- read scale-out.

## 7. Ma trận ưu tiên mới

| Hạng mục | Ưu tiên | Lý do |
|---|---|---|
| Phase 0 measurement + baseline | P0 | Không có nó thì mọi tối ưu phía sau đều mù |
| Update storage docs đang stale | P0 | Tài liệu hiện tại lệch code/config thực tế |
| Query-driven indexes | P1 | Low risk nếu được benchmark trước |
| Continuous aggregates đúng query class | P1 | Mở khóa analytics mà không phá raw write path |
| Archive manifest + verified export | P1 | Điều kiện tiên quyết trước khi giảm retention raw |
| `service-query` | P2 | Chỉ cần khi query workload đã rõ |
| PostGIS/spatial layer | P2 | Giá trị cao nhưng không phải việc đầu tiên |
| Read replica / read scale-out | P3 | Complexity cao, chỉ đáng làm khi read pressure xuất hiện |

## 8. Những việc không nên làm mù quáng

Không nên làm ngay nếu chưa có benchmark:
- đổi chunk interval,
- thêm GIN cho toàn bộ `metadata`,
- backfill `geom` toàn bảng,
- giảm retention raw,
- dựng replica chỉ để “cho có”,
- tạo continuous aggregate cardinality gần bằng raw.

## 9. Kết luận cuối

Plan cũ đúng về hướng tổng thể, nhưng thứ tự và mức độ rủi ro chưa đủ chặt.

Bản v2 này chốt lại 3 nguyên tắc:
1. **write path đang tốt, đừng phá nó bằng migration nặng thiếu benchmark;**
2. **mọi tối ưu query phải bám query class thật;**
3. **retention dài hạn chỉ bền khi có lifecycle và archive được kiểm chứng.**

Hướng thực thi hợp lý nhất cho project hiện tại:
1. đo và chốt baseline,
2. sửa docs cho khớp runtime,
3. thêm backlog P11 cho storage scalability,
4. sau đó mới chọn migration/query-service nào thật sự đáng làm.
