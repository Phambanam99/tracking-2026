Dưới đây là bản **Tài liệu Yêu cầu Sản phẩm (PRD)** phiên bản hoàn chỉnh và chi tiết nhất cho dự án **Tracking**. Bản PRD này đã được thiết kế lại hoàn toàn theo kiến trúc **"Hợp đồng API chuẩn" (Smart Endpoints, Dumb Pipes)**, loại bỏ khối Adapter trung gian và quy định rõ cách xử lý luồng dữ liệu bất đồng bộ từ các crawler.

---

# **TÀI LIỆU YÊU CẦU SẢN PHẨM (PRD) \- DỰ ÁN TRACKING**

**Phiên bản:** 2.0

**Mục tiêu dự án:** Xây dựng hệ thống theo dõi chuyến bay thời gian thực (Real-time Flight Tracking), chịu tải 100.000 messages/giây từ đa nguồn (crawlers). Hệ thống cung cấp API chuẩn mực để hứng dữ liệu, xử lý nhiễu động học, giải quyết triệt để vấn đề dữ liệu đến muộn (late-arriving) và render mượt mà trên bản đồ WebGL.

---

## **1\. Yêu cầu Công nghệ & Hạ tầng (Tech Stack)**

* **Backend Core:** Kotlin 1.9+, Spring Boot 3.x (Sử dụng WebFlux & Coroutines để tối ưu Non-blocking I/O).  
* **Message Broker:** Apache Kafka (Phân mảnh theo icao).  
* **Database:** PostgreSQL 15+ tích hợp TimescaleDB (Time-series) và PostGIS (Spatial).  
* **Caching:** Caffeine Cache (In-memory, độ trễ nano-giây).  
* **Frontend:** ReactJS 18+, Vite, TypeScript, TailwindCSS, shadcn/ui.  
* **Bản đồ (Mapping):** MapLibre GL JS (WebGL render), Zustand (State Management).  
* **Hệ điều hành Server:** CentOS (Tinh chỉnh sysctl.conf cho TCP/UDP throughput lớn).

---

## **2\. Hợp đồng API chuẩn (API Contract)**

Để đảm bảo tính mở rộng vô hạn, Backend KHÔNG làm nhiệm vụ map dữ liệu. Mọi nguồn Crawler muốn đưa dữ liệu vào hệ thống **bắt buộc** phải chuyển đổi cấu trúc JSON của họ khớp với Interface chuẩn sau đây trước khi gọi API POST /api/v1/ingest:

JSON

// Payload chuẩn gửi theo mảng (Batch) để giảm tải HTTP overhead

\[

  {

    "icao": "888123",           // Bắt buộc: String (Mã 24-bit)

    "lat": 21.0285,             // Bắt buộc: Double (Vĩ độ)

    "lon": 105.8542,            // Bắt buộc: Double (Kinh độ)

    "altitude": 32000,          // Tùy chọn: Integer (Đơn vị: feet)

    "speed": 850.5,             // Tùy chọn: Double (Đơn vị: km/h)

    "heading": 45.0,            // Tùy chọn: Double (0 \- 360 độ)

    "event\_time": 1708941600000,// Bắt buộc: Long (Epoch milliseconds lúc crawler bắt được sóng)

    "source\_id": "crawler\_hn\_1" // Bắt buộc: String (Định danh nguồn gửi)

  }

\]

---

## **3\. Yêu cầu Chức năng (Functional Requirements \- FR)**

* **FR1 \- Unified Ingestion:** Cung cấp API WebFlux tiếp nhận mảng JSON chuẩn. Hệ thống tự động đẩy dữ liệu này vào Kafka topic raw-adsb mà không tốn CPU để parse/map phức tạp.  
* **FR2 \- Cross-Source Deduplication (Lọc trùng lặp đa nguồn):** Nếu 5 crawler cùng bắt được 1 tọa độ của 1 máy bay và gửi về, hệ thống dùng thuật toán băm (Hash: icao\_lat\_lon\_eventTime) lưu vào Caffeine Cache (TTL 2 giây). Các gói tin đến sau có cùng Hash sẽ bị loại bỏ ngay lập tức.  
* **FR3 \- Out-of-Order & Event-Time Handling (Xử lý Crawler trễ):**  
  * Hệ thống so sánh event\_time của gói tin mới với event\_time của trạng thái máy bay đang lưu trong Cache.  
  * *Nếu event\_time CŨ HƠN:* Đánh dấu là dữ liệu lịch sử (Historical). **Chỉ lưu DB**, chặn không gửi qua WebSocket để tránh làm máy bay giật lùi trên UI.  
  * *Nếu event\_time MỚI HƠN:* Tiếp tục xử lý live.  
* **FR4 \- Kinematic Validation (Xác thực động học):** Tự động loại bỏ dữ liệu ảo do lỗi đồng hồ của crawler bằng cách tính toán khoảng cách (Haversine) và vận tốc giữa 2 điểm. Nếu $v \> 1200$ km/h \-\> Drop.  
* **FR5 \- Data Enrichment (Làm giàu dữ liệu):** Nhúng metadata (Cờ quốc gia, Loại máy bay, Hãng, Link ảnh) vào payload dựa trên mã icao thông qua Reference DB lưu sẵn trên RAM.  
* **FR6 \- Spatial Broadcasting:** Lọc không gian (Bounding Box) trên RAM. Chỉ push dữ liệu qua WebSocket tới các client đang xem vùng bản đồ có chứa máy bay đó.  
* **FR7 \- Time-Series Storage:** Ghi toàn bộ dữ liệu hợp lệ (cả live và historical) vào TimescaleDB Hypertable bằng cơ chế Batching (gom 5000-10000 rows/lần insert).

---

## **4\. Yêu cầu Phi chức năng (Non-Functional Requirements \- NFR)**

* **NFR1 \- Throughput:** Toàn bộ hệ thống phải chịu tải liên tục 100.000 msg/s.  
* **NFR2 \- API Performance:** Endpoint /api/v1/ingest phải phản hồi cấu trúc luồng (Flow) với độ trễ $\< 5$ ms.  
* **NFR3 \- Scaling:** Thiết kế Stateless cho các khối Ingestion, Processing và Broadcaster để dễ dàng nhân bản (chạy nhiều instance) trên server CentOS.  
* **NFR4 \- UI FPS:** Frontend duy trì 60 FPS khi render $\\ge 10.000$ marker trên MapLibre GL JS, không rò rỉ bộ nhớ (memory leak) khi chạy liên tục 24h.

---

## **5\. Phân rã Microservices & Kế hoạch Tác vụ (Tasks Breakdown)**

Dự án tổ chức dạng Monorepo với cấu trúc: tracking-backend/

### **5.1. Module common-dto (Hợp đồng dữ liệu)**

* **Nhiệm vụ:** Chứa các Data Class dùng chung cho toàn hệ thống.  
* **Files chính:**  
  * CanonicalFlight.kt: Khớp với API Contract JSON.  
  * EnrichedFlight.kt: Payload đã xử lý để gửi xuống UI và DB.

### **5.2. Module service-ingestion (API Gateway)**

* **Nhiệm vụ:** Mở API, nhận mảng JSON, đẩy thẳng vào Kafka.  
* **Tasks:**  
  * Thiết lập WebFlux REST Controller.  
  * Cấu hình Kafka Producer tối ưu throughput (batch.size=32768, linger.ms=5, compression.type=lz4).  
* **Files chính:**  
  * TrackingController.kt: Hàm @PostMapping("/ingest") suspend fun ingest(...)  
  * KafkaProducerConfig.kt

### **5.3. Module service-processing (Não bộ hệ thống)**

* **Nhiệm vụ:** Deduplication \-\> Sort by EventTime \-\> Kinematic Check \-\> Enrich \-\> Split Topics.  
* **Tasks:**  
  * Thiết lập CaffeineCache cho LastKnownState và DedupKey.  
  * Viết logic rẽ nhánh: Đẩy data trễ vào topic historical-adsb, đẩy data hợp lệ vào live-adsb.  
  * Viết thuật toán Haversine.  
* **Files chính:**  
  * FlightStateFusionEngine.kt: Consumer chính, gom lô các message cùng icao, sort theo event\_time rồi mới xử lý.  
  * KinematicValidator.kt  
  * ReferenceDataLoader.kt

### **5.4. Module service-storage (Ghi CSDL)**

* **Nhiệm vụ:** Lắng nghe cả 2 topic live và historical, gom lô lưu vào TimescaleDB.  
* **Tasks:**  
  * Tạo script SQL init TimescaleDB (Hypertable).  
  * Viết JDBC Batch Updater.  
* **Files chính:**  
  * TimescaleInit.sql: Bảng flight\_positions phân mảnh theo cột event\_time.  
  * BatchPersistWorker.kt: Bộ đệm 10k messages \-\> jdbcTemplate.batchUpdate.

### **5.5. Module service-broadcaster (Phát sóng UI)**

* **Nhiệm vụ:** Lọc theo Bounding Box và bắn WebSocket.  
* **Tasks:**  
  * Tạo WebSocket STOMP Server.  
  * Quản lý danh sách Session và tọa độ khung nhìn của từng user.  
* **Files chính:**  
  * WebSocketConfig.kt  
  * ViewportRegistry.kt: Map chứa \<SessionId, BoundingBox\>.  
  * SpatialPushEngine.kt

### **5.6. Module frontend-ui (Vite \+ React)**

* **Nhiệm vụ:** Render bản đồ.  
* **Tasks:**  
  * Cài đặt MapLibre GL JS.  
  * Tạo custom hook quản lý WebSocket STOMP. Dữ liệu nhận về được lưu vào useRef (không dùng useState).  
  * Cài đặt bộ đếm thời gian (Animation Frame) để map data từ useRef sang WebGL Layer.

Bạn hoàn toàn chính xác\! Trong lúc quá tập trung vào việc giải quyết bài toán hiệu năng (100k msg/s) và luồng dữ liệu thời gian thực, bản PRD vừa rồi đã bỏ sót một thành phần xương sống bắt buộc phải có khi đưa hệ thống lên môi trường thực tế (Production): **Module Quản lý Người dùng và Xác thực (User & Authentication).**

Trong kiến trúc Microservices, chúng ta sẽ không nhét code Auth vào chung với khối xử lý data. Thay vào đó, chúng ta bổ sung thêm một Microservice thứ 5: **service-auth (Identity & Access Management \- IAM)**.

### **BỔ SUNG PRD: MODULE XÁC THỰC VÀ NGƯỜI DÙNG (service-auth)**

Đặc thù của hệ thống Tracking này là có 2 đối tượng truy cập hoàn toàn khác nhau cần được bảo mật:

1. **Machine-to-Machine (Crawlers \-\> Ingestion):** Yêu cầu tốc độ cực cao, sử dụng **API Key** tĩnh để xác thực.  
2. **Human-to-Machine (Users \-\> Frontend \-\> Broadcaster):** Yêu cầu bảo mật phiên làm việc, phân quyền UI, sử dụng **JWT (JSON Web Token)**.

#### **1\. Yêu cầu Chức năng (Functional Requirements \- FR)**

* **FR-AUTH1 (Quản lý User & Role):** Đăng ký, đăng nhập, phân quyền người dùng (Ví dụ: ROLE\_ADMIN được xem toàn cầu, ROLE\_USER chỉ được xem máy bay dân sự, hoặc giới hạn khu vực xem).  
* **FR-AUTH2 (JWT Generation & Validation):** Cấp phát Access Token (sống ngắn) và Refresh Token (sống dài) khi người dùng đăng nhập. Cung cấp API nội bộ để các service khác verify token.  
* **FR-AUTH3 (API Key Management):** Quản lý và cấp phát API Key cho 5 nguồn Crawlers. Cho phép Admin khóa (revoke) ngay lập tức một API Key nếu crawler đó bị lộ mã nguồn.  
* **FR-AUTH4 (WebSocket Security):** Bảo vệ endpoint WebSocket ở khối service-broadcaster. Hệ thống phải chặn ngay lập tức các kết nối STOMP/WebSocket nếu không có JWT hợp lệ trong header khi thực hiện Handshake.

#### **2\. Kiến trúc & Công nghệ**

* **Framework:** Spring Boot 3.x \+ Spring Security 6\.  
* **Token:** thư viện io.jsonwebtoken (JJWT) xử lý chuẩn sinh/giải mã token.  
* **Database:** Vẫn dùng PostgreSQL, nhưng sẽ tạo các bảng quan hệ truyền thống (Relational Tables: users, roles, api\_keys) ở một Schema (hoặc DB) riêng biệt, **tuyệt đối không** dùng chung bảng Hypertable của TimescaleDB để đảm bảo hiệu năng.

---

#### **3\. Cập nhật Cấu trúc Monorepo & Chi tiết Tasks**

Bổ sung module mới vào file settings.gradle.kts:

Kotlin

include("service-auth")

**Phân bổ Task và File cốt lõi cho service-auth:**

* **Task 1: Xây dựng Core Security & JWT**  
  * SecurityConfig.kt: Cấu hình Spring Security, tắt CSRF (vì dùng API), cấu hình bộ lọc phân quyền các endpoint (như /api/v1/auth/login thì public).  
  * JwtService.kt: Chứa logic generateToken(), extractUsername(), isTokenValid().  
  * JwtAuthenticationFilter.kt: Bộ lọc chặn trước các request để kiểm tra header Authorization: Bearer \<token\>.  
* **Task 2: Quản lý Người dùng (User Management)**  
  * UserEntity.kt & UserRepository.kt (Spring Data JPA).  
  * AuthController.kt: Mở các API /login, /register, /refresh-token.  
* **Task 3: Bảo vệ API Ingestion (Machine Auth)**  
  * Mặc dù Ingestion nhận 100k msg/s, ta không thể gọi DB hay gọi service-auth 100k lần/giây để check quyền.  
  * *Giải pháp tối ưu:* service-auth sẽ cung cấp API Keys cho crawlers. Khối service-ingestion sẽ cache danh sách API Key hợp lệ này trên RAM (Caffeine). Khi JSON bay vào, chỉ cần check $header\["x-api-key"\] in local\_cache (mất chưa tới 0.1ms).  
  * ApiKeyEntity.kt & ApiKeyController.kt (Bên trong service-auth).  
* **Task 4: Tích hợp WebSocket Security (Bên trong service-broadcaster)**  
  * Cập nhật file WebSocketConfig.kt ở service phát sóng.  
  * Bổ sung ChannelInterceptor: Khi Frontend gọi kết nối tới ws://domain/live, interceptor sẽ bóc tách JWT từ payload xác thực, gọi hàm verify. Nếu hợp lệ mới cho phép nâng cấp giao thức lên WebSocket.

---

#### **4\. Kế hoạch bên Frontend (ReactJS)**

* Tạo AuthContext.tsx hoặc dùng Zustand store (useAuthStore) để lưu trữ trạng thái đăng nhập và JWT.  
* Viết Axios Interceptor tự động đính kèm Authorization: Bearer \<token\> vào mọi HTTP request gửi lên backend.  
* Xây dựng UI Component: Màn hình Đăng nhập/Đăng ký, Trang Dashboard quản lý profile (đổi mật khẩu), và Trang Admin (quản lý user, tạo API Key cho crawler).

---

## **BỔ SUNG PRD: MODULE CỔNG GIAO TIẾP TẬP TRUNG (service-gateway)**

### **1. Yêu cầu Chức năng (Functional Requirements - FR)**

* **FR-GW1 (Dynamic Routing - Định tuyến động):**
  * Request vào `/api/v1/auth/**` -> Đẩy về `service-auth`.
  * Request vào `/api/v1/ingest/**` -> Đẩy về `service-ingestion`.
  * Request vào `/ws/live/**` -> Đẩy về `service-broadcaster` (hỗ trợ `ws://` và `wss://`).
* **FR-GW2 (Centralized Authentication - Xác thực tập trung):**
  * API Gateway chặn request không hợp lệ ngay tại lớp cửa vào.
  * Đọc header JWT hoặc API Key, xác thực nhanh trước khi forward đến service nội bộ.
* **FR-GW3 (Rate Limiting - Giới hạn tốc độ):**
  * Chống DDoS, ví dụ `/login` chỉ cho phép 5 request/giây/IP.
* **FR-GW4 (CORS Management):**
  * Xử lý CORS tập trung tại Gateway để frontend khác domain gọi API không bị chặn.

### **2. Cấu trúc Monorepo & Chi tiết Tasks**

* Bổ sung module mới vào `settings.gradle.kts`:

```kotlin
include("service-gateway")
```

* **Task 1: Cấu hình Định tuyến (Routing)**
  * Sử dụng Spring Cloud Gateway, cấu hình chủ yếu qua `application.yml`.
  * Định nghĩa `Predicates` (điều kiện URL) và `Filters` (bộ lọc) để điều hướng traffic.
* **Task 2: Bộ lọc Xác thực Toàn cục (Global Authentication Filter)**
  * `JwtAuthenticationFilter.kt`: chặn request vào endpoint cần bảo vệ, kiểm tra JWT, trả `401 Unauthorized` nếu không hợp lệ/hết hạn.
  * `ApiKeyFilter.kt`: kiểm tra `x-api-key` cho luồng ingest tốc độ cao.
* **Task 3: Cấu hình Giới hạn tốc độ (Rate Limiter)**
  * Tích hợp Redis để đếm và giới hạn request.
  * `RateLimiterConfig.kt`: cấu hình token bucket theo IP hoặc API Key.
