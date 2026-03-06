# Hướng dẫn Setup GeoServer với Natural Earth Shapefile

> **Lưu ý**: OSM vẫn là provider mặc định (online). GeoServer chỉ cần config khi deploy offline.
> Người dùng chọn GeoServer provider trên toolbar bản đồ và hệ thống dùng env var để biết URL.

## Bước 1: Khởi động GeoServer

```bash
cd infrastructure
bash deploy.sh geoserver
```

Chờ GeoServer khởi động (~60s), truy cập: **http://localhost:8600/geoserver/web/**

- **Username**: `admin`
- **Password**: `geoserver`

## Bước 2: Dữ liệu Shapefile

Dữ liệu Natural Earth 10m Cultural nằm tại `infrastructure/db_geo/10m_cultural/`.

`docker-compose-geoserver.yml` đã tự động mount thư mục này vào container:
```yaml
- ./db_geo/10m_cultural/10m_cultural:/opt/geoserver/geodata:ro
```

→ **Không cần copy thủ công**, chỉ cần đảm bảo thư mục `db_geo/10m_cultural/` tồn tại trước khi start container.

## Bước 3: Tự động tạo Workspace, Store, Publish Layers (1 lệnh)

```bash
cd infrastructure
bash geoserver-init.sh
```

Script sẽ tự động:
- Tạo workspace `tracking`
- Tạo store `natural-earth-10m` (Directory of Shapefiles)
- Publish **tất cả** layers từ shapefile
- Tạo layer group `basemap` (gom countries, tỉnh, đường, sân bay, cảng)

> Nếu muốn làm thủ công từng bước, xem phần **Hướng dẫn thủ công** phía dưới.

## Bước 4: Kiểm tra Layer

Vào **Layer Preview** (`http://localhost:8600/geoserver/web/`) → tìm `tracking:basemap` → click **OpenLayers**.

---

<details>
<summary><strong>Hướng dẫn thủ công (nếu không dùng script)</strong></summary>

### Tạo Workspace

1. Vào **Data** → **Workspaces** → **Add new workspace**
2. Điền:
   - **Name**: `tracking`
   - **Namespace URI**: `http://tracking.local/geoserver`
3. Tick **Default Workspace**
4. Click **Submit**

### Tạo Store (Directory of Shapefiles)

1. Vào **Data** → **Stores** → **Add new Store**
2. Chọn **Directory of spatial files (shapefiles)** (trong _Vector Data Sources_)
3. Điền:
   - **Workspace**: `tracking`
   - **Data Source Name**: `natural-earth-10m`
   - **URL**: `file:///opt/geoserver/geodata`
4. Click **Save**

### Publish Layers

Cho mỗi layer cần dùng:
1. Click **Publish**
2. Trong tab **Data**:
   - Click **Compute from data** cho _Native Bounding Box_
   - Click **Compute from native bounds** cho _Lat/Lon Bounding Box_
3. Click **Save**

### Tạo Layer Group

1. Vào **Data** → **Layer Groups** → **Add new layer group**
2. **Name**: `basemap`, **Workspace**: `tracking`
3. Add các layer cần thiết, click **Generate Bounds**, click **Save**

</details>

---

## Bước 9: Config Frontend (env var)

Tạo file `.env.local` trong thư mục `frontend-ui/`:

```env
# Thêm GeoServer WMS provider vào danh sách map provider
VITE_MAP_PROVIDERS='[{"id":"geoserver-wms","name":"GeoServer (WMS)","labelKey":"map.provider.geoserverWms","category":"online","sourceType":"wms","url":"/geoserver/tracking/wms","wmsLayers":"tracking:basemap","wmsVersion":"1.3.0","wmsFormat":"image/png","crossOrigin":"anonymous"}]'

# (Tùy chọn) Đặt GeoServer làm provider mặc định khi deploy offline
# Nếu không set, OSM vẫn là mặc định
VITE_MAP_DEFAULT_PROVIDER=geoserver-wms
```

> **Giải thích**:
> - `VITE_MAP_PROVIDERS`: JSON array thêm provider mới vào toolbar bản đồ
> - `VITE_MAP_DEFAULT_PROVIDER`: ID của provider mặc định (bỏ dòng này nếu muốn giữ OSM)
> - `url`: Sửa URL nếu GeoServer chạy ở máy/port khác (ví dụ `http://192.168.1.100:8600/geoserver/tracking/wms`)

## Bước 10: Kiểm tra trên Frontend

1. Start frontend: `cd frontend-ui && npm run dev`
2. Mở trình duyệt tại `http://localhost:5173`
3. Trên toolbar bản đồ, thấy nút **GeoServer (WMS)** — click để chuyển
4. Kiểm tra bản đồ có render đúng không

Nếu GeoServer chưa sẵn sàng, chuyển sang **OpenStreetMap** — hệ thống tự fallback.

## Khắc phục lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Không thấy nút GeoServer trên toolbar | Chưa set `VITE_MAP_PROVIDERS` | Kiểm tra `.env.local` bước 9 |
| Bản đồ trắng/404 | Layer chưa publish | Kiểm tra bước 5-6 |
| CORS error | GeoServer chặn cross-origin | Kiểm tra `CORS_ENABLED=true` trong docker-compose |
| Tile không load khi dev | Proxy chưa hoạt động | Kiểm tra `vite.config.ts` có proxy `/geoserver` |
| Bản đồ bị lệch | SRS không đúng | Đảm bảo layer publish với `EPSG:3857` |
