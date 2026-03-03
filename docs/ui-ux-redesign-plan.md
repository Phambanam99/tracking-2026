# UI/UX Redesign Plan - Tracking 2026

> Ngay cap nhat: 2026-03-03
> Scope: `frontend-ui`
> Stack: React 18 + TypeScript + Vite + Tailwind CSS + OpenLayers + Zustand

## Muc tieu

- Dat UI theo huong `map-first`: ban do chiem toan bo viewport, UI la cac floating overlay.
- Giam che map, giam xung dot panel, giam nhieu control co dinh.
- Ho tro desktop va mobile trong cung mot shell thong nhat.
- Dua UX den muc co the van hanh that, khong chi la visual redesign.

## Nguyen tac thiet ke

- Map la trung tam.
- Chi mo mot panel cung phia tai mot thoi diem.
- Control quan trong phai nhin thay nhanh, control phu thi an sau menu/panel.
- Motion co muc dich, khong lam user mat phuong huong.
- Mobile uu tien touch target lon va bottom-sheet behavior.
- i18n song ngu Anh/Viet, Viet la mac dinh.

## Trang thai hien tai

### U1 - Foundation

Trang thai: Done

- `AppShell` da thay the layout cu.
- Map fullscreen.
- Glass tokens, motion utility, `IconButton`, `OverlayPanel`, keyboard shortcuts da co.
- `App.tsx` da dung shell moi.

### U2 - Command Bar + Navigation

Trang thai: Mostly done

- `CommandBar` da co live aircraft search, recent items, command actions, keyboard navigation.
- Navigation khong con theo sidebar trai co dinh.
- Huong thuc te da chuyen sang `menu button` o goc phai tren de tranh che map.

Con thieu:

- Neu can, co the bo sung deep command set hon nua.

### U3 - Panels Redesign

Trang thai: Mostly done

- `SearchPanel`, `WatchlistPanel`, `LayerPanel`, `AircraftPopup`, `AircraftDetailPanel` da duoc redesign.
- Panel conflict resolution da co:
  - desktop: mot panel trai, detail panel tach rieng
  - mobile: mot bottom sheet tai mot thoi diem

Con thieu:

- Toast/skeleton system dung nghia plan van chua hoan tat.

### U4 - Bottom Toolbar + Polish

Trang thai: Done

- Floating `ToolBar` da co.
- `MapStatusBar` da compact hon.
- `AltitudeLegend` da doi thanh thanh ngang gon.
- Auth/Admin pages da duoc boc lai theo shell moi.
- Tooltip va focus states da duoc cai thien.

### U5 - Responsive + Mobile

Trang thai: In progress, gan xong

Da xong:

- `BottomTabBar` cho mobile.
- `Search`, `Watchlist`, `Playback`, `Layers` da mo theo kieu bottom sheet tren mobile.
- `CommandBar` da mo gan full-width tren mobile.
- `AircraftDetailPanel` da chuyen sang dang bottom sheet tren mobile.
- Touch target dang duoc dua ve muc `>= 44px`.

Con thieu:

- Swipe-down to close cho mobile sheets.
- Neu can, bo sung gesture polish va reduced-motion pass sau.

### U6 - Micro-interactions + Final Polish

Trang thai: Chua bat dau day du

- Da co mot phan transition/hover state.
- Chua co reduced-motion pass day du.
- Chua co full accessibility QA va performance QA theo checklist cuoi.

## Scope thay doi so voi ban plan goc

- Khong dua `lucide-react`, `@headlessui/react`, `framer-motion` vao ngay.
  - Ly do: giam rui ro migration, giam bundle pressure, uu tien ship shell truoc.
- Khong giu left icon rail co dinh.
  - Ly do: no che map va va cham voi OpenLayers controls.
  - Thay the bang menu button goc phai tren.
- Khong tao `Sheet.tsx` rieng ngay tu dau.
  - Mobile sheet duoc trien khai bang cach mo rong `OverlayPanel`.

## Kien truc UI hien tai

### Shell

- `src/layout/AppShell.tsx`
- `src/layout/Sidebar.tsx`
- `src/layout/CommandBar.tsx`
- `src/layout/ToolBar.tsx`
- `src/layout/BottomTabBar.tsx`

### Shared system

- `src/shared/components/IconButton.tsx`
- `src/shared/components/OverlayPanel.tsx`
- `src/shared/hooks/useKeyboardShortcuts.ts`
- `src/shared/hooks/useMediaQuery.ts`
- `src/shared/i18n/I18nProvider.tsx`

### Map-facing panels

- `src/features/search/components/SearchPanel.tsx`
- `src/features/watchlist/components/WatchlistPanel.tsx`
- `src/features/map/components/LayerPanel.tsx`
- `src/features/playback/components/PlaybackPanel.tsx`
- `src/features/aircraft/components/AircraftDetailPanel.tsx`
- `src/features/aircraft/components/AircraftPopup.tsx`

## Uu tien tiep theo

### Priority 1

- Chot not `U5`:
  - swipe-down close cho mobile sheets
  - reduced overlap giua bottom tab bar, playback, detail sheet
  - kiem tra touch ergonomics tren man hinh hep

### Priority 2

- Bat dau `U6`:
  - prefers-reduced-motion
  - toast system
  - skeleton loading states nhat quan

### Priority 3

- Don dep tai lieu va naming:
  - dong bo wording giua plan va implementation
  - bo cac mo ta da khong con dung nhu left sidebar rail co dinh

## Definition of done cho redesign

- Map van la vung uu tien so 1 tren desktop va mobile.
- Khong con panel che nhau theo cach lam user mat control.
- Search, watchlist, playback, layers, detail deu dung duoc tren mobile.
- Touch target dat muc toi thieu 44px cho action chinh.
- Build xanh, test lien quan xanh.
- Tai lieu phan anh dung huong implementation thuc te.
