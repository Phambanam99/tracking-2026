# Threat Model (Initial)

## Abuse cases
- Flood `/api/v1/auth/login`
- Replay request với API key bị lộ
- Bypass gateway gọi trực tiếp internal service
- Token theft trên client

## Controls
- Rate limiter + IP reputation
- Revoke propagation + short-lived access token
- Internal network isolation
- Strict CORS + secure token handling
