# Network Security Baseline

- `service-gateway` là entrypoint public duy nhất.
- Các service nội bộ chỉ publish cổng trong private network.
- Chặn direct access từ internet tới `service-auth`, `service-ingestion`, `service-processing`, `service-storage`, `service-broadcaster`.
- Áp dụng policy deny-by-default cho east-west traffic, chỉ mở flow cần thiết.

## Migration note
- Runtime stack local/dev chuẩn hóa tại `infrastructure/`.
- Baseline Kubernetes/Helm nằm tại `infrastructure/k8s`.
- File này giữ vai trò policy tham chiếu trong giai đoạn chuyển tiếp.
