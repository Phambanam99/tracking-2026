# Source Profile: RadarBox

**Ngay:** 2026-03-01  
**Nguon de xuat:** `RADARBOX-GLOBAL`  
**Kieu nguon:** gRPC-web/protobuf snapshot feed, can adapter lai sang gateway ingest

## 1. Ket luan review

Collector RadarBox co the dung duoc lam nen de onboard, nhung khong the noi truc tiep vao platform hien tai.

Nhung diem tot:
- decode gRPC-web/protobuf thay vi scrape HTML
- co field ICAO24 (`ms`) rieng
- timestamp upstream co ve da la milliseconds
- payload co cau truc on dinh hon browser snapshot

Nhung diem chua dung voi contract hien tai:
1. dang day vao Bull queue, khong phai HTTP ingest
2. schema dau ra dang la `Hexident/Latitude/UnixTime/...`
3. `Speed` chua convert sang `km/h`
4. `UnixTime` dang bi ha tu ms xuong seconds trong code cu
5. `BATCH_SIZE=5000` vuot tran ingest
6. chua co `x-api-key`, `x-request-id`, `traceparent`

## 2. Mapping dung sang platform

| RadarBox raw | Platform field | Xu ly |
|---|---|---|
| `ms` | `icao` | uppercase, 6 ky tu hex |
| `la` | `lat` | float |
| `lo` | `lon` | float |
| `alt` | `altitude` | giu nguyen neu hop le |
| `gs` | `speed` | mac dinh coi la knots -> `km/h` |
| `hd` | `heading` | giu neu trong `0..360` |
| `t` | `event_time` | giu o milliseconds |

## 3. Cac canh bao du lieu

- `gs` duoc xu ly nhu knots theo kinh nghiem feed cong khai, nhung can xac minh lai bang benchmark/doi chieu.
- `t` khong duoc chia `1000` nua khi gui vao platform nay.
- Cac field `Callsign/Register/OperatorCode/Type/Source/military` hien chua duoc ingest contract su dung.

## 4. Go-live criteria

Chi onboard `RADARBOX-GLOBAL` neu:
1. adapter moi gui den `/api/v1/ingest/adsb/batch`
2. co API key rieng cho `RADARBOX-GLOBAL`
3. batch duoc chunk theo `<=1000` records va `<=220KB`
4. `event_time` giu nguyen milliseconds
5. smoke test gateway -> storage pass

## 5. Trang thai

- Source nay phu hop lam global public feed phu tro.
- Khong nen coi la source authority duy nhat.
