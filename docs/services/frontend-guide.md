# Hướng Dẫn Sử Dụng: frontend-ui

## 1. Giới Thiệu

**Frontend-ui** là giao diện web để theo dõi bay realtime. Người dùng đăng nhập, xem bản đồ với máy bay di chuyển, và quản trị (nếu là admin).

---

## 2. Khởi Động Nhanh

```bash
cd frontend-ui

# Cài dependencies
npm install

# Chạy dev server
npm run dev
# → Mở trình duyệt: http://localhost:5173
```

### Yêu cầu
- Node.js 18+
- Gateway đang chạy tại `http://localhost:8080` (hoặc `http://localhost:18080` cho Docker)

---

## 3. Sử Dụng

### 3.1 Đăng ký tài khoản

1. Mở `http://localhost:5173`
2. Nhấn "Đăng ký"
3. Nhập username, email, mật khẩu (≥ 12 ký tự, có hoa/thường/số/đặc biệt)
4. Nhấn "Đăng ký" → tự đăng nhập

### 3.2 Đăng nhập

1. Mở `http://localhost:5173`
2. Nhập username + mật khẩu
3. Nhấn "Đăng nhập"

### 3.3 Xem bản đồ

Sau khi đăng nhập:
1. Bản đồ hiển thị với WebSocket kết nối tự động
2. Máy bay xuất hiện dưới dạng marker trên bản đồ
3. Zoom/Pan → viewport tự cập nhật → chỉ nhận flight trong vùng đang nhìn
4. Click vào marker → xem chi tiết (ICAO, tốc độ, độ cao, quốc gia)

### 3.4 Quản lý API Key (Admin)

1. Đăng nhập bằng tài khoản admin
2. Vào trang "API Keys"
3. Nhấn "Tạo mới" → nhập Source ID → lấy API key
4. Sao chép API key (chỉ hiển thị 1 lần)
5. Thu hồi: nhấn "Thu hồi" bên cạnh key

### 3.5 Quản lý Người Dùng (Admin)

1. Đăng nhập bằng tài khoản admin
2. Vào trang "Người dùng"
3. Xem danh sách (phân trang)
4. Bật/Tắt người dùng bằng nút toggle

---

## 4. Cấu Hình

### Biến môi trường (file `.env`)

```env
VITE_API_BASE_URL=http://localhost:8080
```

Đường dẫn API gateway. Thay đổi khi deploy production.

---

## 5. Build Production

```bash
cd frontend-ui

# Build
npm run build
# → Output tại dist/

# Preview build
npm run preview
```

---

## 6. Xử Lý Sự Cố

### Trang trắng sau đăng nhập

**Kiểm tra:**
1. Gateway đang chạy? `curl http://localhost:8080/actuator/health`
2. Console DevTools có lỗi CORS không? → Kiểm tra CORS config gateway

### Bản đồ không hiển thị máy bay

**Kiểm tra:**
1. WebSocket connected? (DevTools → Network → WS → kiểm tra frame messages)
2. Service-broadcaster đang chạy?
3. Có dữ liệu đang ingest vào không? (`curl http://localhost:8082/actuator/prometheus | grep accepted`)
4. Viewport có đúng vùng có máy bay không?

### Token hết hạn

Frontend tự refresh token trong background. Nếu refresh fail:
- User bị redirect về trang đăng nhập
- Đăng nhập lại để lấy token mới

### Bản đồ giật (lag)

**Nguyên nhân:** Quá nhiều flight data.
**Xử lý:**
1. Zoom lại vùng nhỏ hơn (giảm số flight)
2. Frontend dùng requestAnimationFrame → nên mượt với 1000+ flights
3. Kiểm tra browser performance tab

---

## 7. Test

```bash
cd frontend-ui
npm test           # Chạy unit tests
npm run test:ui    # UI test mode
```

---

## 8. Triển Khai

### Docker

```bash
docker build -t tracking/frontend-ui:latest -f frontend-ui/Dockerfile .
docker run -p 80:80 tracking/frontend-ui:latest
```

### Kubernetes

Frontend được deploy như static files serve bởi nginx, cấu hình trong Helm chart hoặc separate deployment.

Cấu hình `VITE_API_BASE_URL` trỏ tới gateway domain production (ví dụ: `https://tracking.example.com`).
