# Source Profile: Flightradar24

**Ngày:** 2026-03-01  
**Nguồn đề xuất:** `FR24-GLOBAL`  
**Kiểu nguồn:** HTTP JSON snapshot theo nhiều zone, không phải direct connector cho platform hiện tại

## 1. Kết luận review

Collector NestJS này có phần tốt:
- đã hiểu được cấu trúc dữ liệu FR24 theo zone,
- đã biết `value[0]` mới là ICAO24 thật, không phải JSON key,
- đã có batching, priority zones và một lớp dedupe theo `hexident`.

Nhưng ở trạng thái hiện tại, nó **không tích hợp trực tiếp** với platform này.

Lý do:
1. đầu ra đang là `Bull queue` (`adsb-processing`), không phải HTTP ingest qua gateway,
2. shape dữ liệu vẫn theo model cũ (`Hexident`, `Latitude`, `UnixTime`, `Source`),
3. `Speed` vẫn là knots,
4. `UnixTime` vẫn là seconds,
5. `BATCH_SIZE = 5000` vượt trần ingest hiện tại,
6. chưa có `x-api-key`, `x-request-id`, `traceparent`,
7. merge dedupe hiện tại chọn “first seen”, chưa chắc là record tốt nhất.

Kết luận ngắn:
- **FR24 là nguồn có thể dùng được.**
- **Code hiện tại là adapter cho hệ khác, chưa phải connector production cho platform này.**

## 2. Mismatch với contract hiện tại

### 2.1 Sai output target

Code hiện tại:

```ts
@InjectQueue('adsb-processing') private processingQueue: Queue
```

và đẩy batch vào:

```ts
await this.processingQueue.add('process-batch', batch, ...)
```

Platform hiện tại yêu cầu:

```text
POST /api/v1/ingest/adsb/batch
```

qua gateway với API key.

### 2.2 Sai schema đầu ra

Code hiện tại transform ra:

```ts
{
  Hexident,
  Longitude,
  Latitude,
  Bearing,
  Altitude,
  Speed,
  UnixTime,
  UpdateTime,
  Callsign,
  Register,
  OperatorCode,
  Source,
  military
}
```

Platform hiện tại nhận:

```json
{
  "records": [
    {
      "icao": "ABC123",
      "lat": 21.0285,
      "lon": 105.8542,
      "altitude": 35000,
      "speed": 850.0,
      "heading": 45.0,
      "event_time": 1709280000000
    }
  ]
}
```

### 2.3 Sai units / thời gian

Theo chính comment trong code:
- `value[4]`: altitude feet
- `value[5]`: speed knots
- `value[10]`: Unix timestamp seconds

Như vậy nếu chuyển sang platform hiện tại thì phải:
- giữ `altitude` nguyên nếu đã là feet,
- đổi `speed_knots -> km/h` bằng `* 1.852`,
- đổi `UnixTime seconds -> event_time milliseconds` bằng `* 1000`.

### 2.4 Sai batch size cho ingest HTTP

Code hiện tại:

```ts
private readonly BATCH_SIZE = 5000;
```

Trong platform hiện tại:
- max records per batch = `1000`
- payload policy = `256 KB`

Nghĩa là adapter mới phải chunk theo:
- count `<= 1000`
- bytes `<= ~220KB` để chừa headroom

### 2.5 Chưa có auth/tracing headers

Collector hiện tại chưa gửi:
- `x-api-key`
- `x-request-id`
- `traceparent`

Muốn tích hợp đúng phải thêm các header này.

## 3. Những điểm đúng và có thể giữ lại

### 3.1 Dùng `value[0]` làm ICAO24 là đúng

Đây là phần tốt nhất trong code:
- JSON key của FR24 là internal flight id thay đổi theo flight,
- `value[0]` mới là hexident thật của aircraft.

Nếu port sang connector mới, logic này phải giữ nguyên.

### 3.2 Chia zone theo priority là có giá trị business

Việc ưu tiên:
- Việt Nam
- Biển Đông
- các vùng lân cận

là hợp lý cho bài toán của bạn.

Nếu tiếp tục dùng FR24, nên giữ tư duy này.

### 3.3 Giới hạn concurrency upstream là hợp lý

`MAX_CONCURRENT_REQUESTS = 5` là quyết định tương đối an toàn hơn so với 10 khi scrape upstream có nguy cơ rate-limit.

## 4. Những vấn đề cần sửa nếu muốn dùng thật

### 4.1 Merge strategy đang quá ngây thơ

Hiện tại `fetchAndMergeZones()` làm:
- duyệt kết quả theo thứ tự zone,
- nếu `hexident` đã có rồi thì bỏ record sau.

Vấn đề:
- cùng một máy bay có thể xuất hiện ở nhiều zone overlap,
- record sau có thể mới hơn hoặc giàu field hơn,
- nhưng current logic luôn giữ record đầu tiên.

Khuyến nghị:
- merge theo `hexident`,
- ưu tiên record có `UnixTime` mới hơn,
- nếu bằng nhau thì ưu tiên record có nhiều field non-null hơn,
- nếu vẫn bằng nhau thì ưu tiên zone business-critical.

### 4.2 `FETCH_TIMEOUT` đang khai báo nhưng không dùng

Code có:

```ts
private readonly FETCH_TIMEOUT: number;
```

nhưng trong `fetchZone()` lại hardcode:

```ts
const timeoutId = setTimeout(() => controller.abort(), 8000);
```

Đây là bug cấu hình rõ ràng.

Phải thay bằng `this.FETCH_TIMEOUT`.

### 4.3 `console.log` trong Nest service

Trong `transformAircraftData()` đang dùng `console.log`.

Với service production, nên dùng `this.logger.debug(...)` hoặc bỏ sampling log nếu không có nhu cầu.

### 4.4 `error.message` trên unknown error

Đoạn:

```ts
catch (error) {
  this.logger.error(`Error in collection loop: ${error.message}`);
}
```

không an toàn nếu `error` không phải `Error`.

Nên normalize:

```ts
const message = error instanceof Error ? error.message : String(error);
```

### 4.5 `military: false` là đúng hơn ADSBX, nhưng vẫn không có tác dụng hiện tại

Field `military` hiện sẽ không đi vào ingest contract hiện tại.

Nếu business cần classifying military/civilian:
- phải có backlog metadata riêng,
- không nên nghĩ chỉ gửi field này là hệ thống sẽ lưu.

### 4.6 Field `Source: 'flightradar24.com'` không thay thế được `source_id`

Trong platform hiện tại, danh tính nguồn phải đến từ API key.

Khuyến nghị:
- cấp API key cho `FR24-GLOBAL`,
- để gateway canonicalize `source_id=FR24-GLOBAL`,
- không dựa vào field `Source`.

## 5. Mapping đúng sang platform

### 5.1 Mapping tối thiểu an toàn

| FR24 raw | Platform field | Xử lý |
|---|---|---|
| `value[0]` | `icao` | uppercase, trim, giữ 6 ký tự |
| `value[1]` | `lat` | float |
| `value[2]` | `lon` | float |
| `value[4]` | `altitude` | giữ nguyên nếu valid |
| `value[5]` | `speed` | knots -> km/h |
| `value[3]` | `heading` | dùng nếu xác minh nằm trong `0..360` |
| `value[10]` | `event_time` | seconds -> milliseconds |

### 5.2 Những field hiện chưa có chỗ đi

Các field sau hiện không nên gửi vì ingest sẽ bỏ qua:
- `Callsign`
- `Register`
- `OperatorCode`
- `Source`
- `military`
- `UpdateTime`

Nếu muốn giữ chúng, cần backend backlog riêng cho metadata passthrough hoặc enrichment source table.

## 6. Adapter đúng cho platform hiện tại

### 6.1 Request headers

```text
Content-Type: application/json
x-api-key: <issued-api-key-for-FR24-GLOBAL>
x-request-id: fr24-<cycle>-<batch>
traceparent: <optional>
```

### 6.2 Request body

```json
{
  "records": [
    {
      "icao": "888123",
      "lat": 21.0285,
      "lon": 105.8542,
      "altitude": 35000,
      "speed": 852.0,
      "heading": 45.0,
      "event_time": 1709280000000
    }
  ]
}
```

### 6.3 Success criteria mới

Thành công là:

```ts
response.status === 202
```

không phải `200/201`.

## 7. Pseudocode transform đúng

```ts
function toIngestRecord(value: unknown[]): Record<string, unknown> | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const icao = value[0] ? String(value[0]).trim().toUpperCase() : null;
  const lat = Number(value[1]);
  const lon = Number(value[2]);
  const heading = value[3] == null ? null : Number(value[3]);
  const altitude = value[4] == null ? null : Number(value[4]);
  const speedKnots = value[5] == null ? null : Number(value[5]);
  const unixSeconds = value[10] == null ? null : Number(value[10]);

  if (!icao || icao.length !== 6) return null;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) return null;
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return null;

  const record: Record<string, unknown> = {
    icao,
    lat,
    lon,
    event_time: Math.trunc(unixSeconds * 1000),
  };

  if (Number.isFinite(altitude) && altitude >= 0) {
    record.altitude = Math.trunc(altitude);
  }

  if (Number.isFinite(speedKnots) && speedKnots >= 0) {
    record.speed = Math.round(speedKnots * 1.852 * 10) / 10;
  }

  if (Number.isFinite(heading) && heading >= 0 && heading <= 360) {
    record.heading = heading;
  }

  return record;
}
```

## 8. Đánh giá vận hành

### Nên dùng FR24 như gì?

Hợp lý nhất:
- nguồn global public snapshot,
- source phụ trợ/fallback,
- coverage source cho khu vực rộng.

Không nên coi là:
- nguồn military authority,
- nguồn realtime chính cho tactical UI,
- nguồn duy nhất cho dữ liệu nhạy cảm.

### Tần suất polling

`REFRESH_INTERVAL=60000ms` là bảo thủ và ổn nếu:
- đây là nguồn phụ,
- mục tiêu là giảm upstream pressure.

Nếu giảm thấp hơn:
- phải theo dõi 429/403 từ upstream,
- và phải tính lại bandwidth + CPU transform.

## 9. Risk register

| Rủi ro | Mức độ | Ghi chú |
|---|---|---|
| Upstream FR24 đổi schema | Cao | collector có thể gãy ngay |
| Overlap zone gây merge sai | Trung bình-Cao | first-write-wins chưa đủ tốt |
| Sai units nếu map trực tiếp | Cao | speed/timestamp là 2 chỗ sai rõ nhất |
| Batch quá lớn cho ingest HTTP | Cao | `5000` records không dùng được |
| Compliance / ToS của nguồn | Cao | cần xác nhận trước production |
| Nhiều field bị drop silently | Trung bình | dễ gây ảo giác “đã lưu metadata” |

## 10. Quyết định triển khai đề xuất

### Go nếu:
- collector được tách khỏi Bull queue và đổi sang HTTP ingest adapter,
- `speed` được convert `knots -> km/h`,
- `UnixTime` được convert `seconds -> milliseconds`,
- batch được chunk theo `<=1000` records và `<=220KB`,
- merge strategy được sửa tối thiểu theo freshest/best record,
- API key riêng `FR24-GLOBAL` đã được cấp,
- smoke test gateway -> storage pass.

### No-go nếu:
- vẫn đẩy raw model cũ `Hexident/Latitude/UnixTime`,
- vẫn để `BATCH_SIZE=5000` khi gọi ingest HTTP,
- vẫn không có `x-api-key`,
- vẫn dùng `first seen wins` cho zone overlap mà không chấp nhận rủi ro dữ liệu,
- chưa xác nhận compliance của upstream source.

## 11. Kết luận

FR24 source này có giá trị vì:
- coverage rộng,
- JSON dễ parse hơn ADSBX,
- đã có logic chia vùng theo ưu tiên business.

Nhưng để dùng với platform hiện tại, phải sửa tối thiểu:
1. đổi output target từ Bull queue sang gateway ingest,
2. đổi schema sang `records[]`,
3. convert `speed` và `event_time`,
4. giảm batch và chunk theo bytes,
5. gắn API key + request id,
6. sửa merge strategy cho zone overlap.

Nếu làm đúng các bước trên, đây là một nguồn phụ trợ tốt cho `FR24-GLOBAL`.
