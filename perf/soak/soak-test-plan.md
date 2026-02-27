# Soak Test Plan (24h)

## Mục tiêu
- Xác nhận không memory leak trong ingestion khi chạy tải dài.
- Kiểm chứng policy fail-fast: quá tải admission trả `429`, producer timeout trả `503`.
- Kiểm chứng hành vi khi Kafka rebalance/broker down/broker slow.

## Baseline Load
- Ingestion giữ tải ổn định `30k msg/s` liên tục trong `24h`.
- Chạy song song workload batch `/api/v1/ingest/adsb/batch` ở mức `500 req/s`.
- Broadcaster giữ `1000` websocket clients giả lập để duy trì áp lực end-to-end.

## Failure Matrix
1. Kafka broker down 60s:
   Expect ingestion tăng `503`, không tăng heap không giới hạn.
2. Kafka disk throttling (slow broker):
   Expect p95 publish latency tăng, ingestion fail-fast theo `delivery.timeout.ms <= 1000`.
3. Kafka consumer rebalance:
   Expect revocation event có thể redeliver nhưng cache state vẫn đúng (idempotent).
4. Admission pressure (vượt max-in-flight):
   Expect ingestion trả `429` nhanh, không treo request.

## Chỉ số theo dõi
- JVM heap usage (`used`, `max`, slope theo thời gian)
- GC pause (`p95`, `max`)
- Ingestion error taxonomy count (`400/401/429/503`)
- Kafka producer timeout/error rate
- Kafka lag (`auth-revocation`, `raw-adsb`)
- DB write latency

## Exit Criteria
- Heap plateau ổn định, không tăng tuyến tính qua 24h.
- Không OOM, không full GC lặp.
- Tỷ lệ `503` chỉ tăng trong failure window có chủ đích.
- Sau failure, service hồi phục và throughput trở về baseline trong 5 phút.
