# Architecture

## High-level flow
1. Crawler gửi batch chuẩn vào `service-gateway`.
2. Gateway xác thực/rate limit/CORS và route vào `service-ingestion`.
3. Ingestion publish Kafka topic `raw-adsb` với key = `icao`.
4. `service-processing` xử lý dedup + event-time + kinematic + enrichment.
5. Kết quả tách sang `live-adsb` và `historical-adsb`.
6. `service-storage` ghi batch vào TimescaleDB.
7. `service-broadcaster` push realtime qua WebSocket theo viewport.
