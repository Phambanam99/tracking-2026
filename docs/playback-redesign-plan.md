# Playback System Redesign Plan

> **Ngày:** 2026-03-03  
> **Mục tiêu:**
>
> 1. Redesign Playback UI theo FR24-style — đơn giản, trực quan, không chặn tương tác bản đồ.
> 2. Giải quyết bài toán Backend/Scale — Chunking cho queries dài (lên tới 7 ngày) và refetch khi chuyển vùng bản đồ.
>    **Triển khai:** Chia thành **Milestone 1 (UI MVP)** và **Milestone 2 (Backend Scale)** để giảm thiểu rủi ro.

---

## 1. Tổng quan vấn đề hiện tại

### So sánh: Hiện tại vs. Mong muốn

| #   | Tính năng                 | Hiện tại (❌ Sai)                                                             | Mong muốn (✅ Đúng, giống ảnh)                                                         |
| --- | ------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | **UI Layout**             | Panel 320px floating ở bottom-left, choán bản đồ                              | **2 phần riêng biệt:** Dialog chọn ngày (modal) + Bottom Bar toàn chiều ngang khi play |
| 2   | **Chọn ngày/giờ**         | 3 input `datetime-local` (From, To, Current) — phức tạp, không ai hiểu        | **Đơn giản:** 1 date picker + 2 dropdown (giờ/phút) + nút "Now" + "Start playback"     |
| 3   | **Viewport query**        | Hiển thị bbox coords (N/S/E/W) + freeze checkbox — quá technical              | **Ẩn hoàn toàn** — tự capture viewport hiện tại khi start, không cần hiển thị          |
| 4   | **Timeline**              | Range slider đơn giản (frame index) — không có time labels, không zoom        | **Timeline bar** có time markers (00:00, 00:30...), scrubber, zoom in/out timeline     |
| 5   | **Speed control**         | Range slider 250ms–5000ms — hiển thị "Xs/step" không trực quan                | **Speed slider** hiển thị "300x" format, trực quan hơn                                 |
| 6   | **Zoom Timeline**         | Không có                                                                      | **Có** — slider + nút +/- để zoom in/out timeline, xem chi tiết hơn                    |
| 7   | **Tương tác bản đồ**      | Live data bị TẮT ngay khi mở panel (`liveDataEnabled = !playbackOpen`)        | **Map vẫn tương tác bình thường** — zoom, pan, drag đều hoạt động khi playback         |
| 8   | **Playback bar position** | Panel chồng lên map, chiếm góc trái dưới                                      | **Bottom bar full-width** — nằm sát đáy, map.padding điều chỉnh                        |
| 9   | **Transport controls**    | 7 nút nhồi trong 1 hàng 320px — chật, khó bấm                                 | **Play/Pause** tích hợp timeline bar, nút < > chevron phải/trái                        |
| 10  | **Loading workflow**      | Phải bấm "Load" thủ công sau khi chỉnh from/to                                | **"Start playback"** trong dialog → auto load data → show timeline bar                 |
| 11  | **Ngày hiện tại**         | Dùng `datetime-local` input — cách hiển thị native khác nhau trên mỗi browser | **"Mar 2, 2026"** hiển thị trực tiếp trên timeline bar                                 |
| 12  | **Select Date button**    | Không có — phải quay lại chỉnh `datetime-local`                               | **Nút calendar icon** trên timeline bar → mở lại dialog chọn ngày                      |

### Bug quan trọng nhất

| #   | Bug                                                                                         | Ảnh hưởng                               |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------- |
| B1  | `liveDataEnabled = !playbackOpen` — tắt live data ngay khi MỞ panel, trước cả khi load xong | Bản đồ trống (stale) trong lúc loading  |
| B2  | `setCurrentFrameIndex()` luôn set `isPlaying: false` — drag slider là pause                 | Scrub timeline bị gián đoạn playback    |
| B3  | Re-capture viewport liên tục khi freeze=false và user pan map                               | Viewport query thay đổi không mong muốn |
| B4  | `findNearestFrameIndex` O(n) linear scan — chậm với 1000+ frames                            | Lag khi scrub timeline                  |
| B5  | `setInterval` thay vì `requestAnimationFrame` — timing không chính xác                      | Playback giật, không smooth             |
| B6  | Không giới hạn số frame/event — time range 6h + viewport lớn có thể tạo hàng nghìn frames   | Memory overflow, browser crash          |

---

## 2. UI Design mới — 2 phần

### Phần A: Playback Dialog (Modal)

Hiện khi user bấm nút Playback trên ToolBar. Đơn giản, chỉ chọn ngày + giờ.

```
┌────────────────────────────────────────┐
│           Playback              ✕     │
│                                        │
│  ┌──────────┐ ┌──────┐                │
│  │ 📅 DATE  │ │ Now  │                │
│  └──────────┘ └──────┘                │
│                                        │
│  ┌────────────────────────────────┐    │
│  │      Mar 3, 2026               │    │
│  └────────────────────────────────┘    │
│                                        │
│  🕐 TIME (UTC)                         │
│  ┌──────┐     ┌──────┐                │
│  │  00  │  :  │  45  │                │
│  │  ▼   │     │  ▼   │                │
│  └──────┘     └──────┘                │
│                                        │
│  ┌────────────────────────────────┐    │
│  │      Start playback            │    │
│  └────────────────────────────────┘    │
│                                        │
└────────────────────────────────────────┘
```

**Behavior:**

- Bấm nút playback trên toolbar → mở dialog này
- "Now" button → set date/time = bây giờ
- Date picker: calendar popup chọn ngày
- Hour/Minute: dropdown select
- "Start playback":
  1. Capture viewport hiện tại (invisible, auto)
  2. Tính time range: `timeFrom = selectedDateTime`, `timeTo = selectedDateTime + 3h` (default window)
  3. Fetch data → build frames → chuyển sang Playback Bar
- Đóng: nút ✕ hoặc Esc
- Glassmorphism styling theo design system

### Phần B: Playback Timeline Bar (Bottom Bar)

Hiện FULL-WIDTH ở đáy màn hình sau khi data loaded. Map vẫn tương tác bình thường.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 📅 SELECT  │ ⏸ │ ◀ │ ─────PLAYBACK TIMELINE───── │Mar 2, 2026│01:06:30 UTC│ ▶ │ ZOOM ⓘ │SPEED ⓘ│ ✕│
│    DATE     │   │   │ :30  00:00  00:30  01:00  01:30  02:00  02:30        │   │ - ●── + │  ●─ 300x│  │
│             │   │   │ ◄═══════════════╋══════════════════════════════════►  │   │         │        │  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Layout (trái→phải):**

1. **SELECT DATE** (📅) — calendar icon button → mở lại Dialog (Phần A)
2. **Play/Pause** — toggle button lớn
3. **◀ Prev** — step backward (hoặc skip 30s)
4. **PLAYBACK TIMELINE** — timeline scrubber với:
   - Time markers (00:00, 00:30, 01:00...) tùy zoom level
   - Scrubber handle (draggable)
   - Current position indicator (vertical line)
   - Date display: "Mar 2, 2026"
   - Time display: "01:06:30 UTC"
5. **▶ Next** — step forward (hoặc skip 30s)
6. **ZOOM TIMELINE** (ⓘ) — slider + nút -/+ để zoom in/out timeline
   - Zoom in = xem chi tiết hơn (ví dụ: 30 phút visible)
   - Zoom out = xem tổng quan (ví dụ: 3 giờ visible)
7. **SPEED** (ⓘ) — slider hiển thị "300x"
   - Range: 1x → 1000x
   - Hiển thị: "1x", "10x", "50x", "100x", "300x", "500x", "1000x"
8. **✕ Close** — đóng playback, quay về live mode

**Styling:**

- Full width, `position: fixed; bottom: 0; left: 0; right: 0`
- Height: ~60-70px
- Background: `rgba(10, 18, 32, 0.95)` + `backdrop-filter: blur(20px)`
- Border top: `1px solid rgba(148, 163, 184, 0.12)`
- Z-index: 40 (trên các panel khác)

---

## 3. Thay đổi Bản đồ khi Playback

### Tương tác bản đồ phải giữ nguyên:

- ✅ **Zoom in/out** — scroll wheel, pinch, +/- buttons
- ✅ **Pan/Drag** — kéo bản đồ bằng chuột/touch
- ✅ **Click aircraft** — chọn aircraft, hiện popup/detail
- ✅ **Rotate** — nếu có
- ✅ **All OL interactions** — không disable bất kỳ interaction nào

### Thay đổi data khi playback active:

- ❌ **Tắt live WebSocket** — chỉ tắt khi playback **đã load xong** và đang play (không tắt ngay khi mở dialog)
- ❌ **Ẩn live aircraft layer** — chỉ ẩn khi playback ready
- ✅ **Hiện playback layer** — aircraft từ playback frames
- ✅ **Map padding** — `map.getView().padding = [0, 0, 70, 0]` (để bar không che)

### Khi đóng playback:

- Restore live data ngay lập tức
- Remove playback layer
- Remove map padding
- Smooth transition (no flash)

---

## 4. Store Redesign — `usePlaybackStore`

### State mới

```typescript
type PlaybackStatus = "idle" | "configuring" | "loading" | "ready" | "error";

type PlaybackState = {
  // === Dialog state ===
  isDialogOpen: boolean; // Dialog (Phần A) visibility
  selectedDate: string; // "2026-03-03" (ISO date)
  selectedHour: number; // 0-23
  selectedMinute: number; // 0, 15, 30, 45 (hoặc 0-59 bước 5)

  // === Bar state ===
  isBarVisible: boolean; // Timeline Bar (Phần B) visibility
  isPlaying: boolean;
  status: PlaybackStatus;
  error: string | null;

  // === Playback data ===
  frames: PlaybackFrame[];
  frameCount: number;
  currentFrameIndex: number;

  // === Timeline ===
  timeFrom: number; // epoch ms — start of playback window
  timeTo: number; // epoch ms — end of playback window
  currentTime: number; // epoch ms — current playback position

  // === Controls ===
  speedMultiplier: number; // 1, 10, 50, 100, 300, 500, 1000
  zoomLevel: number; // 0.5 → 4.0 — 1.0 = default, <1 = zoom out, >1 = zoom in
  timelineVisibleRange: number; // ms — visible window on timeline (derived from zoom)

  // === Internal ===
  queryViewport: LonLatExtent | null;
};
```

### Actions mới

```typescript
type PlaybackActions = {
  // Dialog
  openDialog: () => void;
  closeDialog: () => void;
  setSelectedDate: (date: string) => void;
  setSelectedHour: (hour: number) => void;
  setSelectedMinute: (minute: number) => void;
  setNow: () => void;

  // Playback lifecycle
  startPlayback: () => Promise<void>; // Dialog → Load → Bar
  stopPlayback: () => void; // Bar → idle, restore live

  // Transport
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seekToTime: (epochMs: number) => void;
  seekToFrame: (index: number) => void;
  stepForward: () => void;
  stepBackward: () => void;

  // Controls
  setSpeedMultiplier: (speed: number) => void;
  setZoomLevel: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;

  // Select Date (from bar)
  reopenDialog: () => void; // Pause + show dialog again
};
```

### Speed Model mới

Thay `speedMs` (interval delay) bằng `speedMultiplier`:

| speedMultiplier | Ý nghĩa                             | Frame interval (nếu bucket 15s) |
| --------------- | ----------------------------------- | ------------------------------- |
| 1x              | Real-time — 15s thực = 15s playback | 15000ms                         |
| 10x             | 10 lần nhanh hơn                    | 1500ms                          |
| 50x             | 50 lần nhanh hơn                    | 300ms                           |
| 100x            | 100 lần nhanh hơn                   | 150ms                           |
| 300x            | 300 lần nhanh hơn (default)         | 50ms                            |
| 500x            | 500 lần nhanh hơn                   | 30ms                            |
| 1000x           | 1000 lần nhanh hơn                  | 15ms                            |

**Công thức:** `intervalMs = bucketSizeMs / speedMultiplier`

Với `requestAnimationFrame`, accumulate delta time thay vì dùng `setInterval`:

```typescript
let lastTimestamp = 0;
const accumulatedMs = 0;
const frameIntervalMs = bucketSizeMs / speedMultiplier;

function tick(timestamp) {
  const delta = timestamp - lastTimestamp;
  accumulatedMs += delta;
  while (accumulatedMs >= frameIntervalMs) {
    stepForward();
    accumulatedMs -= frameIntervalMs;
  }
  lastTimestamp = timestamp;
  if (isPlaying) requestAnimationFrame(tick);
}
```

### Zoom Timeline Model

```
zoomLevel: 0.5 → 4.0
visibleDuration = totalDuration / zoomLevel

Ví dụ: totalDuration = 3h
  zoomLevel = 1.0 → thấy toàn bộ 3h
  zoomLevel = 2.0 → thấy 1.5h (scroll để xem phần còn lại)
  zoomLevel = 4.0 → thấy 45 phút
  zoomLevel = 0.5 → thấy 6h (nếu có data)
```

---

## 5. File Changes Plan

### Files mới cần tạo:

| File                                                             | Mô tả                              |
| ---------------------------------------------------------------- | ---------------------------------- |
| `features/playback/components/PlaybackDialog.tsx`                | Modal chọn date/time (Phần A)      |
| `features/playback/components/PlaybackBar.tsx`                   | Bottom timeline bar (Phần B)       |
| `features/playback/components/PlaybackTimeline.tsx`              | Custom timeline/scrubber component |
| `features/playback/components/PlaybackSpeedSlider.tsx`           | Speed control slider               |
| `features/playback/components/PlaybackZoomSlider.tsx`            | Timeline zoom control              |
| `features/playback/hooks/usePlaybackLoop.ts`                     | rAF-based playback loop            |
| `features/playback/components/__tests__/PlaybackDialog.test.tsx` | Tests cho dialog                   |
| `features/playback/components/__tests__/PlaybackBar.test.tsx`    | Tests cho bar                      |

### Files cần sửa:

| File                                                    | Thay đổi                                                 |
| ------------------------------------------------------- | -------------------------------------------------------- |
| `features/playback/store/usePlaybackStore.ts`           | Redesign state + actions cho 2-phase UI                  |
| `features/playback/types/playbackTypes.ts`              | Update types cho new state model                         |
| `features/playback/components/PlaybackPanel.tsx`        | **XÓA** — thay bằng PlaybackDialog + PlaybackBar         |
| `features/playback/components/PlaybackMapLayer.tsx`     | Cập nhật selectors theo store mới                        |
| `features/aircraft/components/AircraftFeatureLayer.tsx` | Sửa `liveDataEnabled` — chỉ tắt khi `status === "ready"` |
| `layout/AppShell.tsx`                                   | Wire PlaybackDialog + PlaybackBar thay cho PlaybackPanel |
| `layout/ToolBar.tsx`                                    | Cập nhật toggle action cho dialog                        |
| `layout/BottomTabBar.tsx`                               | Cập nhật toggle action cho dialog                        |
| `shared/i18n/messages.ts`                               | Thêm keys mới cho Dialog/Bar, xóa keys cũ                |
| `styles.css`                                            | Thêm timeline bar styles, animation keyframes            |
| `features/playback/utils/buildPlaybackFrames.ts`        | Thêm frame limit (max 5000) + return bucketSizeMs        |
| `features/playback/components/PlaybackPanel.test.tsx`   | **XÓA** — thay bằng test files mới                       |

### Files không đổi:

| File                   | Lý do                                            |
| ---------------------- | ------------------------------------------------ |
| `playbackApi.ts`       | API layer vẫn đúng, chỉ đổi caller               |
| `PlaybackMapLayer.tsx` | Chỉ đổi store selectors, logic render giữ nguyên |

---

## 6. Implementation Steps (Chia theo Milestone)

### Milestone 1: MVP UI & Chữa cháy UX (1-2 Sprint)

Mục tiêu: Đưa được UI mới lên để dùng thử, sửa các lỗi UX chết người nhất (đặc biệt: live data bị ngắt sớm, không có timeline/speed trực quan). Do giới hạn hệ thống hiện tại, ta sẽ **giới hạn time range query ở mức ngắn (≤ 6h) và không prefetch/chunking**.

1. **Update `playbackTypes.ts` + `usePlaybackStore.ts`**: Set up state model cho Dialog + Bar phases. Nhưng frames array vẫn giữ nguyên (load 1 cục như cũ).
2. **Tạo PlaybackDialog**: Modal chọn timeline (chống việc giao diện đè lên UI bản đồ).
3. **Tạo bottom bar controls**: PlaybackTimeline, PlaybackSpeedSlider, PlaybackZoomSlider, PlaybackBar. Áp dụng logic zoom timeline + convert từ speedMs sang speedMultiplier (rAF-based loop).
4. **Fix Interaction**: Sửa `liveDataEnabled` trong `AircraftFeatureLayer.tsx` (chỉ ngắt live khi state `isBarVisible = true && status = ready`). Map padding cho bar.
5. **Giới hạn Query Runtime**: Sửa Dialog để chỉ cho phép range tối đa 6 tiếng (nếu gọi với API hiện tại thì limit 5000 rows vẫn là thắt cổ chai, check xem backend request có override được không - tạm chấp nhận bị mất data quá `limit`).
6. **Tháo dỡ đồ cũ**: Cập nhật AppShell, gỡ `PlaybackPanel` cũ.

### Milestone 2: Scale Backend & Chunking (1 Sprint)

Mục tiêu: Chữa cháy bottleneck 5000 rows, kích hoạt tính năng "7 ngày" và "chuyển vùng map khi đang play".

7. **Backend New API**: Implement endpoint `POST /api/v1/playback/frames` trên `service-query`.
   - Viết SQL windowing theo bucket + `ROW_NUMBER()`.
   - Hỗ trợ opaque cursor `(time_ms, offset)`.
8. **Frontend Loader**: Viết hook `usePlaybackDataLoader.ts` để handle logic prefetch (200 frames per batch, fetch tiếp khi < 25% buffer).
9. **Xử lý Viewport Pan**: Thêm event hook debounce 300ms khi map move -> reset chunk buffer, gọi lại backend lấy point-in-time frame.
10. Tích hợp và tháo `buildPlaybackFrames` (client side logic cũ).

### Milestone 3: Hardening

11. Bật nén TimescaleDB + Index Tuning sau khi EXPLAIN ANALYZE.
12. Load tests và error fallback (khi timeout) ở UI. Trả error rate telemetry.

---

## 7. Tương tác bản đồ — Chi tiết

### Trước khi sửa (hiện tại — SAI):

```
User opens playback panel
  → liveDataEnabled = false          ← ❌ Live data STOPS immediately
  → Live layers still VISIBLE but STALE
  → Map shows frozen stale aircraft
  → User must click "Load"
  → Data fetches... layers swap
```

### Sau khi sửa (mới — ĐÚNG):

```
User opens playback dialog (Phần A)
  → Live data STILL RUNNING           ← ✅ Map bình thường
  → User chọn date/time, bấm "Start playback"
  → Dialog shows loading spinner
  → Data fetches... frames built...
  → Dialog closes, PlaybackBar appears
  → liveDataEnabled = false            ← ✅ Chỉ tắt SAU khi data ready
  → Live layers HIDDEN, Playback layer SHOWN
  → Map interactions preserved (zoom, pan, drag)
  → map.getView().padding = [0, 0, 70, 0]  ← ✅ Bar không che map
```

### Khi user đóng playback bar (bấm ✕):

```
  → isBarVisible = false
  → liveDataEnabled = true             ← ✅ Live data resumes
  → Playback layer HIDDEN
  → Live layers SHOWN
  → map.getView().padding = [0, 0, 0, 0]  ← ✅ Restore
  → Clean up frames from memory
```

---

## 8. Speed Control — Chi tiết

### Hiện tại (SAI):

- Speed = `speedMs` (250ms → 5000ms) = delay giữa mỗi step
- Hiển thị: "1.00s / step" — không trực quan
- Người dùng phải hiểu "250ms = nhanh, 5000ms = chậm" — ngược logic

### Mới (ĐÚNG):

- Speed = `speedMultiplier` (1x → 1000x)
- Hiển thị: "300x" — ai cũng hiểu
- `displayInterval = bucketSizeMs / speedMultiplier`
- Slider logarithmic: 1x ──── 10x ──── 100x ──── 1000x

**Preset speeds:** `[1, 5, 10, 25, 50, 100, 200, 300, 500, 1000]`

---

## 9. Timeline Zoom — Chi tiết

### Concept:

- Timeline bar hiển thị 1 "window" of time
- Default: hiện toàn bộ playback duration (ví dụ 3h)
- Zoom in: thu hẹp window → xem chi tiết hơn (ví dụ 30 phút)
- Zoom out: mở rộng window → xem tổng quan

### Implementation:

```
totalDuration = timeTo - timeFrom  (ví dụ: 3h = 10800000ms)
visibleDuration = totalDuration / zoomLevel
visibleFrom = currentTime - visibleDuration / 2  (clamped to [timeFrom, timeTo])
visibleTo = visibleFrom + visibleDuration

Timeline markers: generate ticks based on visibleDuration
  > 2h  → ticks mỗi 30 min
  > 1h  → ticks mỗi 15 min
  > 30m → ticks mỗi 5 min
  > 10m → ticks mỗi 1 min
  ≤ 10m → ticks mỗi 30s
```

### Controls:

- Slider: `min=0.5, max=4.0, step=0.1`
- Nút `-` (zoom out): `zoomLevel = Math.max(0.5, zoomLevel - 0.5)`
- Nút `+` (zoom in): `zoomLevel = Math.min(4.0, zoomLevel + 0.5)`
- Mouse wheel trên timeline: zoom in/out
- Tooltip: "Zoom Timeline" + giải thích

---

## 10. Responsive Design

### Desktop (≥768px):

- PlaybackDialog: centered modal, 420px width
- PlaybackBar: full-width bottom bar, ~70px height
- Timeline: flex-1 (chiếm toàn bộ không gian còn lại)
- All controls visible

### Mobile (<768px):

- PlaybackDialog: full-width bottom sheet
- PlaybackBar: full-width bottom bar, ~56px height
- Ẩn "ZOOM TIMELINE" label — chỉ giữ slider
- Ẩn "SPEED" label — chỉ giữ value "300x" + slider
- Timeline: compact, fewer time markers
- SELECT DATE: icon only (no text)

---

## 11. Keyboard Shortcuts

| Shortcut    | Action                    |
| ----------- | ------------------------- |
| `Space`     | Play/Pause (khi bar open) |
| `←`         | Step backward             |
| `→`         | Step forward              |
| `Shift + ←` | Skip back 30s             |
| `Shift + →` | Skip forward 30s          |
| `Home`      | Jump to start             |
| `End`       | Jump to end               |
| `+`         | Speed up                  |
| `-`         | Speed down                |
| `Ctrl + +`  | Zoom timeline in          |
| `Ctrl + -`  | Zoom timeline out         |
| `Esc`       | Close playback            |

---

## 12. Checklist hoàn thành

- [ ] PlaybackDialog (Phần A) — date/time picker modal
- [ ] PlaybackBar (Phần B) — full-width bottom bar
- [ ] Custom timeline với time markers + scrubber
- [ ] Zoom timeline slider
- [ ] Speed multiplier slider (hiển thị "Nx")
- [ ] `requestAnimationFrame` loop thay `setInterval`
- [ ] Map tương tác bình thường khi playback
- [ ] Fix `liveDataEnabled` — chỉ tắt khi data ready
- [ ] SELECT DATE button trên bar → reopen dialog
- [ ] Map padding cho bar
- [ ] Keyboard shortcuts
- [ ] Responsive (mobile)
- [ ] i18n (EN + VI)
- [ ] Tests
- [ ] Xóa PlaybackPanel cũ

---

## 13. Backend Analysis — Tại sao thiết kế hiện tại KHÔNG hoạt động

### Hạ tầng hiện có

| Component            | Chi tiết                                                                               |
| -------------------- | -------------------------------------------------------------------------------------- |
| **Database**         | PostgreSQL + **TimescaleDB** hypertable `storage.flight_positions`                     |
| **Chunking**         | 1-day chunks, Compression sau 7 ngày (segmentby `icao`, orderby `event_time DESC`)     |
| **Retention**        | Tự động xóa data cũ hơn **90 ngày**                                                    |
| **Indexes**          | `(icao, event_time DESC)`, `(lat, lon)`, unique `(icao, event_time, lat, lon)`         |
| **API endpoint**     | `POST /api/v1/aircraft/search/history` — hard limit **5000 rows**, không cursor/offset |
| **Write throughput** | 5000 records/batch, 5s flush, ON CONFLICT DO NOTHING                                   |

### Ước tính data volume (Vietnam airspace)

| Metric                       | Giá trị        |
| ---------------------------- | -------------- |
| Aircraft đồng thời (avg)     | ~300           |
| Update interval              | ~5 giây        |
| Rows/aircraft/ngày           | ~17,280        |
| **Rows/ngày (all aircraft)** | **~5.2M**      |
| **7 ngày**                   | **~36M rows**  |
| **Row size (uncompressed)**  | ~200–300 bytes |
| **7 ngày uncompressed**      | **~7–11 GB**   |
| **7 ngày compressed**        | ~1–3 GB        |

### Tại sao "load 7 ngày" KHÔNG hoạt động với thiết kế hiện tại

```
Current flow:
  1. User chọn timeFrom=7d ago, timeTo=now, bbox=Vietnam
  2. Frontend gọi POST /api/v1/aircraft/search/history
  3. Backend: SELECT ... WHERE event_time BETWEEN ... AND lat BETWEEN ... LIMIT 5000
  4. Frontend nhận 5000 rows (trong khi thực tế có 36 TRIỆU rows)
  5. buildPlaybackFrames() tạo frames từ 5000 rows
  6. Kết quả: CHỈ THẤY ~50 frames đầu tiên, bỏ mất 99.99% data
```

**3 vấn đề chết người:**

| #   | Vấn đề                         | Chi tiết                                                               |
| --- | ------------------------------ | ---------------------------------------------------------------------- |
| 1   | **Hard limit 5000 rows**       | API chỉ trả tối đa 5000 rows. 7 ngày × Vietnam = 36M rows → mất 99.99% |
| 2   | **No pagination**              | Không có cursor/offset → không thể load thêm                           |
| 3   | **Client-side frame building** | 36M rows trong browser memory = crash                                  |

### Tại sao "chuyển vùng xem" KHÔNG hoạt động

```
Current flow:
  1. User ở Vietnam, bấm Load → data loaded cho bbox Vietnam
  2. User pan sang Thái Lan
  3. Playback vẫn hiện aircraft từ bbox Vietnam cũ
  4. Không có aircraft mới ở Thái Lan → bản đồ trống
  5. Phải bấm lại "Load" để fetch data mới
```

**Viewport bị "đóng cứng"** — data chỉ fetch 1 lần cho 1 bbox cố định.

---

## 14. Giải pháp Backend — Chunked Viewport Snapshots

### Kiến trúc mới: Server-side Frame Generation

Thay vì client load tất cả events rồi tự build frames, **server tạo frames sẵn**:

```
FR24 model:
  "Cho tôi tất cả aircraft nhìn thấy ở bbox X tại thời điểm T"
  → Server trả về 1 snapshot (= 1 frame)
  → Client chỉ render

Our model (pragmatic):
  "Cho tôi N frames từ timeFrom → timeTo trong bbox X"
  → Server trả batches of snapshots (200 frames/batch)
  → Client pre-fetch batch tiếp theo khi gần hết
  → Khi viewport đổi → fetch lại với bbox mới
```

### New Backend Endpoint: `POST /api/v1/playback/frames`

**Request:**

```json
{
  "timeFrom": 1740960000000,
  "timeTo": 1741564800000,
  "boundingBox": { "north": 23.5, "south": 8.0, "east": 110.0, "west": 102.0 },
  "bucketSizeMs": 15000,
  "maxFrames": 200,
  "cursor": null
}
```

**Response:**

```json
{
  "frames": [
    {
      "timestamp": 1740960000000,
      "aircraft": [
        {
          "icao": "780A3B",
          "lat": 21.03,
          "lon": 105.85,
          "altitude": 35000,
          "speed": 480.0,
          "heading": 125.0,
          "eventTime": 1740959998000,
          "sourceId": "adsb-hckt",
          "registration": "VN-A321",
          "aircraftType": "A321",
          "operator": "Vietnam Airlines"
        }
      ]
    }
  ],
  "totalFrames": 40320,
  "returnedFrames": 200,
  "hasMore": true,
  "nextCursor": "1740963000000",
  "bucketSizeMs": 15000,
  "metadata": {
    "queryTimeMs": 342,
    "totalAircraftSeen": 1847
  }
}
```

### SQL Strategy — cho TimescaleDB

**Adaptive bucket size dựa trên time range:**

| Time Range | Bucket Size | Frames count | Lý do                       |
| ---------- | ----------- | ------------ | --------------------------- |
| ≤ 1 giờ    | 5s          | ≤ 720        | Chi tiết cao, ít data       |
| ≤ 6 giờ    | 15s         | ≤ 1,440      | Cân bằng chi tiết/hiệu suất |
| ≤ 24 giờ   | 30s         | ≤ 2,880      | Giảm frames                 |
| ≤ 7 ngày   | 60s         | ≤ 10,080     | Tối ưu cho long-range       |
| > 7 ngày   | 300s (5m)   | Varies       | Overview mode               |

**Core SQL (mỗi batch):**

```sql
-- Step 1: Generate time buckets
WITH buckets AS (
    SELECT generate_series(
        to_timestamp(:timeFrom / 1000.0),
        to_timestamp(:timeTo / 1000.0),
        make_interval(secs => :bucketSizeMs / 1000.0)
    ) AS bucket_time
    LIMIT :maxFrames
),

-- Step 2: Latest position per aircraft per bucket
ranked AS (
    SELECT
        b.bucket_time,
        fp.icao, fp.lat, fp.lon, fp.altitude, fp.speed, fp.heading,
        fp.event_time, fp.source_id,
        fp.metadata->>'registration'   AS registration,
        fp.metadata->>'aircraft_type'  AS aircraft_type,
        fp.metadata->>'operator'       AS operator,
        ROW_NUMBER() OVER (
            PARTITION BY b.bucket_time, fp.icao
            ORDER BY fp.event_time DESC
        ) AS rn
    FROM buckets b
    JOIN storage.flight_positions fp
        ON fp.event_time BETWEEN b.bucket_time - make_interval(secs => :stalenessMs / 1000.0)
                              AND b.bucket_time
        AND fp.lat BETWEEN :south AND :north
        AND fp.lon BETWEEN :west AND :east
)

SELECT bucket_time, icao, lat, lon, altitude, speed, heading,
       event_time, source_id, registration, aircraft_type, operator
FROM ranked
WHERE rn = 1
ORDER BY bucket_time, icao;
```

**Tối ưu TimescaleDB:**

- `event_time` range scan → hit đúng chunks cần thiết (1-day chunks)
- `(lat, lon)` index → filter spatial
- `DISTINCT ON` hoặc `ROW_NUMBER()` → 1 position/aircraft/bucket
- Compressed chunks (>7d) → TimescaleDB auto-decompresses khi query

### Cách xử lý "chuyển vùng" (viewport change)

```
Timeline:
  T=0s:  User đang xem Vietnam, playback đang play
  T=5s:  User pan sang Thái Lan (viewport thay đổi)

Frontend detects viewport change:
  1. Debounce 300ms (tránh spam khi đang kéo)
  2. Pause playback tạm thời
  3. Gọi POST /api/v1/playback/frames với:
     - timeFrom = currentPlaybackTime
     - timeTo = original timeTo
     - boundingBox = NEW viewport (Thái Lan)
     - cursor = null (reset)
  4. Nhận frames mới cho Thái Lan
  5. Replace frame buffer
  6. Resume playback

Kết quả: User thấy aircraft ở Thái Lan ngay lập tức!
```

### Cách xử lý "7 ngày playback"

```
Timeline:
  User chọn: Start = 7 ngày trước, bbox = Vietnam

Frontend flow:
  1. Request batch 1: timeFrom=7d ago, maxFrames=200, cursor=null
     → Server trả 200 frames (= 200 phút ở 60s bucket)
     → hasMore=true, nextCursor="..."

  2. Playback bắt đầu, chạy frame 1→200

  3. Khi playback đến frame ~150 (75% buffer):
     → Pre-fetch batch 2: cursor=nextCursor, maxFrames=200
     → Append vào buffer

  4. Tiếp tục cho đến hết 7 ngày

  5. Nếu user scrub/seek tới vị trí xa:
     → Discard buffer, fetch batch mới từ seek position
     → cursor = seekTime

Kết quả: Playback mượt, luôn có data ahead, memory bounded!
```

### Pre-fetch Strategy

```
                    ┌─── PLAY DIRECTION ───►
                    │
  ┌─────────────────┼────────────────────────┐
  │ ░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ batch N (in buffer)
  │                 ╋                        │
  │              current                     │
  │              frame                       │
  └──────────────────────────────────────────┘
                                    ▲
                                    │ 75% threshold
                                    │
  ┌──────────────────────────────────────────┐
  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ batch N+1 (pre-fetched)
  └──────────────────────────────────────────┘

Memory management:
  - Keep max 3 batches in memory (current + next + prev)
  - Evict oldest batch when 4th loads
  - Max ~600 frames in memory at any time
```

---

## 15. Backend Implementation Plan — `service-query`

### New files cần tạo:

| File                                                                  | Mô tả                            |
| --------------------------------------------------------------------- | -------------------------------- |
| `service-query/src/.../query/playback/PlaybackController.kt`          | REST controller, endpoint mới    |
| `service-query/src/.../query/playback/PlaybackService.kt`             | Business logic, SQL query        |
| `service-query/src/.../query/playback/PlaybackFrameAssembler.kt`      | Group SQL rows → frame structure |
| `service-query/src/.../query/dto/PlaybackFrameRequest.kt`             | Request DTO                      |
| `service-query/src/.../query/dto/PlaybackFrameResponse.kt`            | Response DTO                     |
| `service-query/src/.../query/dto/PlaybackFrameDto.kt`                 | Single frame DTO                 |
| `service-query/src/.../query/dto/PlaybackAircraftDto.kt`              | Aircraft within a frame DTO      |
| `service-query/src/test/.../query/playback/PlaybackServiceTest.kt`    | Unit tests                       |
| `service-query/src/test/.../query/playback/PlaybackControllerTest.kt` | Integration tests                |

### PlaybackController — Endpoint Design

```kotlin
@RestController
@RequestMapping("/api/v1/playback")
class PlaybackController(private val playbackService: PlaybackService) {

    /**
     * Returns batched playback frames for a viewport and time range.
     * Server-side bucketing: groups events into time slots, returns latest
     * position per aircraft per slot.
     */
    @PostMapping("/frames")
    fun getPlaybackFrames(
        @Valid @RequestBody request: PlaybackFrameRequest,
    ): ResponseEntity<PlaybackFrameResponse> {
        val result = playbackService.buildFrames(request)
        return ResponseEntity.ok(result)
    }
}
```

### PlaybackFrameRequest — Validation rules

```kotlin
data class PlaybackFrameRequest(
    @field:NotNull val timeFrom: Long,            // epoch ms, required
    @field:NotNull val timeTo: Long,              // epoch ms, required
    @field:NotNull val boundingBox: BoundingBoxDto, // required
    val bucketSizeMs: Long? = null,               // auto-calculated if null
    @field:Max(500) val maxFrames: Int = 200,     // server clamps
    val cursor: Long? = null,                     // next timeFrom for pagination
    val stalenessMs: Long? = null,                // auto = 3 × bucketSize
) {
    init {
        require(timeFrom < timeTo) { "timeFrom must be before timeTo" }
        require(timeTo - timeFrom <= 7L * 24 * 60 * 60 * 1000) {
            "Maximum time range is 7 days"
        }
    }
}
```

### Indexes — Có thể cần thêm

```sql
-- Composite spatial+temporal index (recommended for playback queries)
-- Current: separate (icao, event_time DESC) and (lat, lon) indexes
-- New: combined index that covers the playback WHERE clause
CREATE INDEX idx_fp_time_latlon
ON storage.flight_positions (event_time DESC, lat, lon);
```

Tuy nhiên TimescaleDB đã chunk theo `event_time` (1-day) nên index hiện tại `(lat, lon)` có thể đủ — cần benchmark.

---

## 16. Frontend Playback Data Strategy — Cập nhật

### Thay đổi so với Plan gốc (Section 5)

| Component                | Plan gốc                             | Plan mới                                             |
| ------------------------ | ------------------------------------ | ---------------------------------------------------- |
| `playbackApi.ts`         | Giữ nguyên                           | **Thêm** `fetchPlaybackFrames()` gọi endpoint mới    |
| `buildPlaybackFrames.ts` | Sửa nhẹ (frame limit, return bucket) | **Có thể xóa** — server trả frames sẵn               |
| `usePlaybackStore.ts`    | Redesign cho Dialog/Bar              | + Thêm chunked loading, pre-fetch, viewport re-fetch |
| `PlaybackBar.tsx`        | Mới                                  | + Render timeline từ server `totalFrames` metadata   |
| `usePlaybackLoop.ts`     | rAF loop                             | + Trigger pre-fetch khi buffer < 25%                 |

### New API function

```typescript
// playbackApi.ts
export async function fetchPlaybackFrames(request: {
  timeFrom: number;
  timeTo: number;
  boundingBox: BoundingBox;
  bucketSizeMs?: number;
  maxFrames?: number;
  cursor?: number | null;
}): Promise<PlaybackFrameResponse> {
  return httpRequest<PlaybackFrameResponse>({
    method: "POST",
    path: "/api/v1/playback/frames",
    body: request,
  });
}
```

### Chunked Loading Hook — `usePlaybackDataLoader.ts`

```typescript
// Manages:
// 1. Initial load when playback starts
// 2. Pre-fetch next batch when buffer is 75% consumed
// 3. Re-fetch on viewport change (debounced 300ms)
// 4. Seek/scrub → discard buffer, fetch from seek position

function usePlaybackDataLoader() {
  // Buffer holds 1-3 batches of frames
  // Triggers fetch automatically based on conditions
  // Exposes: currentFrames, isLoading, isPreFetching, error
}
```

### Viewport Change Flow — Frontend

```typescript
// In PlaybackBar or a dedicated hook
useEffect(() => {
  if (!isPlaybackActive) return;

  // Debounced viewport change handler
  const timer = setTimeout(() => {
    const newViewport = getCurrentViewport();
    if (viewportChanged(lastQueryViewport, newViewport)) {
      // Re-fetch from current playback time with new bbox
      reloadFrames({
        timeFrom: currentPlaybackTime,
        timeTo: originalTimeTo,
        boundingBox: newViewport,
        cursor: null, // reset
      });
    }
  }, 300); // 300ms debounce

  return () => clearTimeout(timer);
}, [viewport, isPlaybackActive]);
```

---

## 17. Tóm tắt: Từ góc nhìn người dùng

### Kịch bản 1: "Playback 7 ngày qua ở Vietnam"

```
1. User bấm Playback → Dialog mở
2. Chọn ngày 7 ngày trước, giờ 00:00 UTC
3. Bấm "Start playback"
4. Frontend gọi: POST /api/v1/playback/frames
   {timeFrom: 7d ago, timeTo: now, bbox: Vietnam, maxFrames: 200}
5. Server:
   - Auto-chọn bucket 60s (vì range > 24h)
   - Trả 200 frames đầu (= 200 phút = ~3.3 giờ)
   - hasMore: true, nextCursor: ...
6. PlaybackBar hiện, playback bắt đầu
7. Timeline hiện tổng 7 ngày, nhưng current window shows ~3h (zoomable)
8. Khi playback đến 75% buffer → auto pre-fetch batch tiếp
9. User có thể scrub tới bất kỳ thời điểm nào trong 7 ngày
   → Frontend fetch batch mới từ vị trí seek
```

### Kịch bản 2: "Xem Vietnam 1 tiếng, chuyển sang Thái Lan"

```
1. Đang playback Vietnam, thấy máy bay bay về hướng Thái Lan
2. User kéo bản đồ sang Thái Lan (pan/drag)
3. Frontend detect viewport change (debounce 300ms)
4. Fetch frames mới:
   POST /api/v1/playback/frames
   {timeFrom: currentPlaybackTime, timeTo: same, bbox: Thái Lan}
5. Replace buffer, resume playback
6. Máy bay ở Thái Lan xuất hiện ngay!
7. Timeline position giữ nguyên
```

### Kịch bản 3: "Zoom in để xem chi tiết sân bay"

```
1. Đang playback heatmap cả Vietnam (nhiều aircraft)
2. User zoom in vào Nội Bài
3. Viewport thu hẹp → trigger re-fetch
4. Server trả frames chi tiết hơn cho bbox nhỏ hơn
   (ít aircraft nhưng cùng spatial accuracy)
5. Playback tiếp tục mượt mà
```
