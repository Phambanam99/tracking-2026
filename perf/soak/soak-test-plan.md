# Soak Test Plan (24h)

## Mục tiêu
- Phát hiện memory leak
- Theo dõi độ ổn định throughput

## Kịch bản
- Ingestion: tải ổn định 30k msg/s trong 24h
- Broadcaster: 1000 websocket clients giả lập

## Chỉ số theo dõi
- JVM heap usage
- GC pause
- Kafka lag
- DB write latency
