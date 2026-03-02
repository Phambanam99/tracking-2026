# Hướng Dẫn Sử Dụng: service-broadcaster

## 1. Giới Thiệu

**Service-broadcaster** đẩy dữ liệu bay realtime đến browser qua WebSocket. Người dùng mở bản đồ → kết nối WebSocket → gửi viewport → nhận flight data chỉ trong vùng đang nhìn.

---

## 2. Khởi Động Nhanh

```bash
# Yêu cầu: Kafka, service-auth đang chạy
./gradlew :service-broadcaster:bootRun --args='--spring.profiles.active=local'

# Kiểm tra
curl http://localhost:8083/actuator/health
```

---

## 3. Kết Nối WebSocket

### Qua Gateway (khuyến nghị)

```javascript
// Frontend code
const socket = new SockJS('http://localhost:8080/ws/live/adsb');
const client = Stomp.over(socket);

client.connect(
  { Authorization: 'Bearer ' + accessToken },
  function(frame) {
    // Gửi viewport
    client.send('/app/viewport', {}, JSON.stringify({
      minLat: 20.5, maxLat: 21.5,
      minLon: 105.0, maxLon: 106.5
    }));

    // Nhận flight data
    client.subscribe('/topic/adsb/live', function(message) {
      const flight = JSON.parse(message.body);
      console.log('Flight:', flight.icao, flight.lat, flight.lon);
    });
  }
);
```

### Kiểm tra bằng wscat

```bash
# Cài wscat
npm install -g wscat

# Kết nối (cần JWT token)
wscat -c ws://localhost:8080/ws/live/adsb \
  -H "Authorization: Bearer eyJhbG..."
```

---

## 4. Luồng Hoạt Động

```
1. Client kết nối WebSocket với JWT → Service xác thực
2. Client gửi viewport (vùng đang nhìn trên bản đồ)
3. Service đọc flight data từ Kafka (live-adsb)
4. Với mỗi flight: kiểm tra có nằm trong viewport client không
5. Nếu nằm trong → push tới client
6. Nếu nằm ngoài → bỏ qua
7. Client zoom/pan → gửi viewport mới → service cập nhật filter
```

---

## 5. Cấu Hình

| Biến | Mặc định | Giải thích |
|---|---|---|
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka broker |
| `AUTH_JWKS_URI` | `http://service-auth:8081/.../jwks.json` | JWKS để xác minh JWT |

---

## 6. Giám Sát

```bash
curl http://localhost:8083/actuator/prometheus | grep ws_
```

| Metric | Cần theo dõi |
|---|---|
| `ws_sessions_active` | Số session hiện tại |
| `ws_push_latency_seconds` p95 | Nên < 100ms |
| `ws_messages_pushed_total` | Tốc độ push |

---

## 7. Xử Lý Sự Cố

### Client không nhận được flight data

**Kiểm tra:**
1. JWT token còn hợp lệ? (hết hạn → kết nối lại)
2. Đã gửi viewport chưa? (không gửi → không nhận)
3. Service-processing có đang publish vào `live-adsb`?
4. Viewport có bao phủ vùng có máy bay?

### Session bị ngắt đột ngột

**Nguyên nhân có thể:**
1. Token bị thu hồi → admin revoke hoặc user logout
2. Session timeout (> 5 phút không hoạt động)
3. Gateway timeout/circuit breaker

### Push chậm (latency cao)

**Xử lý:**
1. Scale thêm broadcaster replicas
2. Kiểm tra Kafka consumer lag
3. Kiểm tra client xử lý message nhanh (không block)

---

## 8. Triển Khai

```yaml
broadcaster:
  replicaCount: 4
  resources:
    requests: { cpu: 500m, memory: 768Mi }
    limits: { cpu: "2", memory: 1536Mi }
```
