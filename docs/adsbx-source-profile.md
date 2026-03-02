# Source Profile: ADS-B Exchange

**Ngày:** 2026-03-01  
**Nguồn đề xuất:** `ADSBX-SNAPSHOT`  
**Kiểu nguồn:** snapshot feed qua browser automation, không phải official push connector

## 1. Kết luận review

Script ADS-B Exchange hiện tại **chưa thể** nối thẳng vào platform hiện tại nếu không sửa.

Lý do chính:
1. đang gọi sai endpoint backend cũ,
2. payload schema sai hoàn toàn với ingest contract hiện tại,
3. không gửi `x-api-key`,
4. xử lý thành công theo `200/201` trong khi endpoint hiện tại trả `202`,
5. gán `event_time = now()` cho toàn bộ snapshot,
6. gắn `military = True` cho mọi aircraft dù URL đang kéo toàn bộ globe,
7. nhiều field được gửi nhưng backend hiện sẽ bỏ qua.

Kết luận ngắn:
- **Có thể dùng ADS-B Exchange như một nguồn crawler.**
- **Không nên coi script hiện tại là production-ready.**
- **Nguồn này nên được onboard như snapshot source phụ trợ, không phải nguồn realtime chuẩn hoặc military-only source, trừ khi có filter/mapping đúng hơn.**

## 2. Mismatch giữa script hiện tại và platform

### 2.1 Sai endpoint

Script hiện tại:

```python
API_ENDPOINT = "https://10.75.20.60/api/aircrafts/adsb/ingest"
```

Platform hiện tại yêu cầu:

```text
POST http://<gateway>/api/v1/ingest/adsb/batch
```

Ví dụ:
- local: `http://localhost:8080/api/v1/ingest/adsb/batch`
- docker: `http://localhost:18080/api/v1/ingest/adsb/batch`

### 2.2 Sai auth model

Script hiện tại không gửi:
- `x-api-key`
- `x-request-id`
- `traceparent`

Trong platform hiện tại, `x-api-key` là bắt buộc.

### 2.3 Sai payload schema

Script hiện tại gửi:

```json
{
  "data": [
    {
      "hexident": "...",
      "latitude": ...,
      "longitude": ...,
      "bearing": ...,
      "unixtime": ...
    }
  ]
}
```

Platform hiện tại cần:

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

### 2.4 Sai success criteria

Script hiện tại:

```python
return response.status_code in [200, 201]
```

Endpoint mới trả `202 Accepted`, nên script hiện tại sẽ báo fail giả ngay cả khi ingest thành công.

### 2.5 `event_time` đang dùng sai ngữ nghĩa

Script hiện tại set:

```python
"unixtime": int(time.time())
```

Vấn đề:
- đó là thời điểm crawler scrape, không phải event time gốc của bản ghi máy bay,
- lại đang ở đơn vị `seconds`, trong khi platform cần `epoch milliseconds`.

Nếu map nguyên xi sang `event_time`, toàn bộ snapshot sẽ bị timestamp sai.

Khuyến nghị:
1. nếu decode được timestamp gốc từ source thì dùng timestamp đó,
2. nếu không decode được thì dùng **snapshot fetch time** một lần cho cả batch và convert sang milliseconds,
3. chấp nhận đây là timestamp xấp xỉ, không phải event time chính xác.

## 3. Đánh giá chất lượng dữ liệu của source này

### 3.1 Đây không phải military-only source theo script hiện tại

Script mô tả:
- “thu thập dữ liệu máy bay quân sự”

Nhưng URL fetch thực tế:

```text
https://globe.adsbexchange.com/re-api/?binCraft&zstd&box=-90,90,-180,180
```

Đây là snapshot toàn cầu theo bounding box toàn thế giới, không phải military filter.

Sau đó script gán:

```python
"military": True
```

cho mọi bản ghi. Điều đó là sai ngữ nghĩa.

Kết luận:
- source này hiện là **global snapshot source**,
- không được dán nhãn military-only nếu chưa có logic filter thực.

### 3.2 Độ realtime thấp hơn các nguồn push/poll nhỏ

`REFRESH_INTERVAL = 60s` nghĩa là:
- dữ liệu chỉ cập nhật 1 lần mỗi phút,
- live map sẽ giật theo snapshot,
- không phù hợp nếu kỳ vọng track mượt như nguồn radar hoặc feed tần suất cao.

Nó phù hợp hơn cho:
- bổ sung coverage,
- source phụ trợ,
- smoke/monitoring,
- fallback feed.

### 3.3 Decode hiện tại mang tính heuristic

Các dấu hiệu:
- swallow exception rộng,
- cố gắng đoán `stride`,
- fallback đảo `lat/lon`,
- unit của `speed` và `track` chưa có chứng cứ rõ trong script.

Khuyến nghị:
- nếu chưa xác minh được unit của `speed`/`heading`, **đừng gửi** chúng,
- tốt hơn gửi ít field nhưng đúng còn hơn gửi đủ field nhưng sai.

## 4. Mapping đúng sang contract hiện tại

### 4.1 Mapping tối thiểu an toàn

| Field từ script | Field gửi lên platform | Ghi chú |
|---|---|---|
| `hex` | `icao` | uppercase, 6 ký tự |
| `lat` | `lat` | giữ nguyên nếu đã là WGS84 decimal |
| `lon` | `lon` | giữ nguyên nếu đã là WGS84 decimal |
| `altitude` | `altitude` | chỉ gửi nếu chắc là feet và hợp lệ |
| `speed` | `speed` | chỉ gửi nếu chắc đơn vị là km/h, hoặc convert nếu biết rõ |
| `track` | `heading` | chỉ gửi nếu chắc đúng `0..360` |
| snapshot fetch time | `event_time` | dùng milliseconds |

### 4.2 Những field hiện không có tác dụng

Các field sau hiện sẽ bị ingest bỏ qua:
- `callsign`
- `type`
- `operator`
- `registration`
- `squawk`
- `military`
- `source`

Lưu ý thêm:
- `operator = a.get("type")` trong script hiện tại là sai nghĩa dữ liệu.
- `source = "adsb_exchange"` cũng không phải nơi quyết định `source_id` của pipeline; `source_id` phải gắn với API key đã cấp.

## 5. Vấn đề kỹ thuật cần sửa trong script

### 5.1 `verify=False`

Không nên dùng:

```python
verify=False
```

trừ khi môi trường test nội bộ buộc phải dùng chứng chỉ self-signed và đã chấp nhận rủi ro.

Khuyến nghị:
- dùng gateway HTTP local trong dev,
- hoặc cài CA đúng nếu gọi HTTPS nội bộ.

### 5.2 Base64 conversion trong browser có nguy cơ vỡ với payload lớn

Đoạn:

```javascript
let base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
```

có thể fail với buffer lớn do:
- giới hạn số lượng arguments,
- memory spike.

Với snapshot toàn cầu, đây là rủi ro thật.

Khuyến nghị:
- encode theo chunks,
- hoặc dùng `FileReader`/`Blob`,
- hoặc chuyển sang fetch ngoài browser nếu tìm được path ổn định và không cần browser session.

### 5.3 Hardcode Chrome binary path

```python
CHROME_BINARY = "/usr/bin/chromium-browser"
```

Đây là brittle.

Khuyến nghị:
- đưa vào env `CHROME_BINARY`,
- fail-fast nếu không tồn tại,
- không hardcode duy nhất cho một distro.

### 5.4 Comment/config đang lệch nhau

Script có:

```python
BATCH_SIZE = 1000  # Giảm lô xuống 50 để tránh timeout backend
```

Comment và giá trị mâu thuẫn. Đây là dấu hiệu config chưa được chốt.

## 6. Khuyến nghị thiết kế connector cho ADS-B Exchange

### 6.1 Source ID

Khuyến nghị dùng:

```text
ADSBX-SNAPSHOT
```

Lý do:
- phản ánh đúng bản chất snapshot,
- không hứa hẹn military-only,
- không giả vờ là feed chuẩn từ một trạm radar riêng.

### 6.2 Request shape chuẩn

```json
{
  "records": [
    {
      "icao": "888123",
      "lat": 21.0285,
      "lon": 105.8542,
      "altitude": 35000,
      "event_time": 1709280000000
    }
  ]
}
```

Headers:

```text
Content-Type: application/json
x-api-key: <issued-api-key>
x-request-id: adsbx-<timestamp>-<batch>
```

`X-Source-Id` có thể không gửi; nếu gửi thì phải là `ADSBX-SNAPSHOT`.

### 6.3 Field policy khuyến nghị

Cho version 1:
- bắt buộc gửi: `icao`, `lat`, `lon`, `event_time`
- chỉ gửi `altitude` khi đã xác minh đúng đơn vị
- chỉ gửi `speed`/`heading` khi đã xác minh unit/scale
- không gửi field ngoài contract

### 6.4 Polling strategy

Nếu vẫn dùng snapshot approach:
- `REFRESH_INTERVAL` nên được benchmark theo load và giá trị business,
- `15-30s` cho monitoring/live coarse,
- `60s` chỉ phù hợp nếu chấp nhận dữ liệu rất thưa.

Nếu feed này chỉ là phụ trợ:
- `30-60s` là chấp nhận được,
- nhưng không nên coi là source chủ lực cho UI realtime.

### 6.5 Chunking

Không chunk chỉ theo số lượng record.

Khuyến nghị:
- `MAX_RECORDS = 1000`
- `TARGET_PAYLOAD_BYTES = 220 * 1024`

## 7. Mẫu transform tối thiểu đúng contract

```python
snapshot_ms = int(time.time() * 1000)

records = []
for a in aircraft_list:
    icao = str(a["hex"]).strip().upper()
    lat = a["lat"]
    lon = a["lon"]

    if len(icao) != 6:
        continue
    if not (-90 <= lat <= 90):
        continue
    if not (-180 <= lon <= 180):
        continue

    record = {
        "icao": icao,
        "lat": float(lat),
        "lon": float(lon),
        "event_time": snapshot_ms,
    }

    altitude = a.get("altitude")
    if altitude is not None and altitude >= 0:
        record["altitude"] = int(altitude)

    # Chỉ bật lại nếu xác minh được unit thật
    # speed = a.get("speed")
    # heading = a.get("track")

    records.append(record)
```

Gửi:

```python
payload = {"records": records}
resp = requests.post(
    f"{GATEWAY_URL}/api/v1/ingest/adsb/batch",
    headers={
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-request-id": request_id,
    },
    json=payload,
    timeout=10,
)
ok = resp.status_code == 202
```

## 8. Rủi ro vận hành

| Rủi ro | Mức độ | Ghi chú |
|---|---|---|
| Trang nguồn thay đổi cơ chế anti-bot | Cao | browser automation có thể gãy bất kỳ lúc nào |
| Payload globe snapshot quá lớn | Cao | gây lỗi JS base64, 413, hoặc spike memory |
| Timestamp chỉ là snapshot time | Trung bình | giảm độ chính xác realtime/event-time |
| Decode unit sai | Cao | speed/heading/altitude có thể bị gửi sai |
| ToS/compliance của nguồn | Cao | cần legal/commercial approval trước production |
| Gắn nhãn military sai | Cao | script hiện tại không có filter military thật |

## 9. Quyết định triển khai đề xuất

### Go nếu:
- source được phê duyệt về compliance,
- connector sửa đúng endpoint/auth/schema,
- chỉ gửi field đã xác minh unit,
- `event_time` dùng milliseconds,
- smoke test qua gateway -> storage pass,
- batching theo bytes đã hoạt động.

### No-go nếu:
- vẫn dùng payload contract cũ,
- vẫn không có `x-api-key`,
- vẫn dùng `verify=False` trong môi trường production,
- vẫn gắn `military=True` cho toàn bộ globe snapshot,
- vẫn coi `200/201` là success.

## 10. Kết luận

ADS-B Exchange có thể là một nguồn hữu ích, nhưng script hiện tại là bản prototype cho một backend khác.

Muốn dùng với platform này, phải sửa tối thiểu:
1. endpoint + auth,
2. request schema,
3. success criteria `202`,
4. `event_time` milliseconds,
5. bỏ các field không có tác dụng,
6. không dán nhãn military nếu chưa có filter thật.

Nguồn này nên được onboard như:
- **snapshot source phụ trợ**
- với `sourceId = ADSBX-SNAPSHOT`
- và rollout thận trọng sau smoke test riêng.
