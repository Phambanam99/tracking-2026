# Source Connectors

Standalone connectors that fetch external aircraft feeds and push batches into this platform through:

`POST /api/v1/ingest/adsb/batch`

Ship connectors push through:

`POST /api/v1/ingest/ais/batch`

Available connectors:
- `adsb_hckt_connector.py` -> `ADSB-HCKT`
- `adsbx_connector.py` -> `ADSBX-SNAPSHOT`
- `fr24_connector.py` -> `FR24-GLOBAL`
- `radarbox_connector.py` -> `RADARBOX-GLOBAL`
- `chinaport_connector.py` -> `CHINAPORT-AIS`
- `aisstream_connector.py` -> `AISSTREAM-IO`
- `ais_signalr_connector.py` -> `AIS-SIGNALR`

## Install

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r connectors/requirements.txt
```

Windows PowerShell:

```powershell
.\connectors\bootstrap_venv.ps1 -PythonBin "C:\Path\To\python.exe"
```

If `py` on your machine points to a stale interpreter, pass an explicit Python path instead of relying on the launcher default.

For connector unit tests only, you can bootstrap a lighter environment:

```powershell
.\connectors\bootstrap_venv.ps1 -PythonBin "C:\Path\To\python.exe" -RequirementsFile "connectors\requirements-test.txt"
```

## Shared env

```bash
export GATEWAY_URL=http://localhost:8080
export API_KEY=trk_live_xxx
export SOURCE_ID=FR24-GLOBAL
export LOG_LEVEL=INFO
```

Optional shared env:
- `MAX_RECORDS_PER_BATCH` default `1000`
- `TARGET_PAYLOAD_BYTES` default `225280`
- `REQUEST_TIMEOUT_SECONDS` default `10`
- `RETRY_ATTEMPTS` default `3`
- `BASE_RETRY_DELAY_SECONDS` default `1.0`
- `SEND_SOURCE_HEADER` default `true`
- `VERIFY_TLS` default `true`
- `INGEST_ENDPOINT_PATH` default `/api/v1/ingest/adsb/batch`

## Run

```bash
python3 connectors/adsb_hckt_connector.py
python3 connectors/fr24_connector.py
python3 connectors/radarbox_connector.py
python3 connectors/adsbx_connector.py
python3 connectors/chinaport_connector.py
python3 connectors/aisstream_connector.py
python3 connectors/ais_signalr_connector.py
```

## Docker Compose

Runtime compose file:
- [docker-compose-connectors.yml](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/infrastructure/docker-compose-connectors.yml)

Default env files:
- [hckt.env](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/connectors/env/hckt.env)
- [adsbx.env](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/connectors/env/adsbx.env)
- [fr24.env](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/connectors/env/fr24.env)
- [radarbox.env](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/connectors/env/radarbox.env)
- [chinaport.env](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/connectors/env/chinaport.env)

These files contain runtime secrets and are ignored by git. Rotate the issued API keys before any shared-environment rollout.

Build and run:

```bash
docker compose -f infrastructure/docker-compose-connectors.yml build
docker compose -f infrastructure/docker-compose-connectors.yml up -d
docker compose -f infrastructure/docker-compose-connectors.yml logs -f fr24-connector
```

By default the env files point to `http://host.docker.internal:18080`.
If your gateway runs elsewhere, update the corresponding `GATEWAY_URL`.

## systemd

Artifacts:
- [tracking-connector@.service](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/infra/systemd/tracking-connector@.service)
- [README.md](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/infra/systemd/README.md)

Example env templates:
- [adsbx.env.example](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/infra/systemd/adsbx.env.example)
- [fr24.env.example](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/infra/systemd/fr24.env.example)
- [radarbox.env.example](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/infra/systemd/radarbox.env.example)

Source-specific envs:

### ADSBX
- `ADSBX_REFRESH_INTERVAL_SECONDS` default `60`
- `ADSBX_URL` default `https://globe.adsbexchange.com`
- `ADSBX_CHROME_BINARY` optional
- `ADSBX_HEADLESS` default `true`
- `ADSBX_INCLUDE_DERIVED_SPEED_HEADING` default `true`

### ADSB-HCKT
- `ADSB_HCKT_URL` default `http://100.100.24.4/tar1090/data/aircraft.json`
- `ADSB_HCKT_REFRESH_INTERVAL_SECONDS` default `3`
- `ADSB_HCKT_TIMEOUT_SECONDS` default `10`
- `ADSB_HCKT_MAX_SEEN_SECONDS` default `15`

### FR24
- `FR24_REFRESH_INTERVAL_SECONDS` default `60`
- `FR24_TIMEOUT_SECONDS` default `10`
- `FR24_MAX_CONCURRENT_REQUESTS` default `5`
- `FR24_COOKIE` optional upstream session cookie for anti-bot protected access
- `FR24_PROXY_URL` optional outbound proxy/VPN for upstream access

### RadarBox
- `RADARBOX_REFRESH_INTERVAL_SECONDS` default `10`
- `RADARBOX_TIMEOUT_SECONDS` default `30`
- `RADARBOX_SPEED_UNIT` default `knots`

### Chinaport SSE
- `INGEST_ENDPOINT_PATH` should be `/api/v1/ingest/ais/batch`
- `CHINAPORT_SSE_URL` default `http://10.75.10.3:8080/sse/vessels`
- `CHINAPORT_PRIORITY_SSE_URL` optional, for the secondary priority vessel stream
- `CHINAPORT_CONNECT_TIMEOUT_SECONDS` default `10`
- `CHINAPORT_READ_TIMEOUT_SECONDS` default `90`
- `CHINAPORT_RECONNECT_DELAY_SECONDS` default `5`

### AISStream
- `INGEST_ENDPOINT_PATH` should be `/api/v1/ingest/ais/batch`
- `AISSTREAM_API_KEY` required
- `AISSTREAM_ENDPOINT` default `wss://stream.aisstream.io/v0/stream`
- `AISSTREAM_BOUNDING_BOXES` default `[[[-90,-180],[90,180]]]` (array of bounding boxes)
- `AISSTREAM_BATCH_SIZE` default `50`
- `AISSTREAM_FLUSH_INTERVAL_SECONDS` default `5`
- `AISSTREAM_RECONNECT_DELAY_SECONDS` default `5`
- `AISSTREAM_MAX_RECONNECT_ATTEMPTS` default `20`
- `AISSTREAM_SOCKET_TIMEOUT_SECONDS` default `1.0`
- `AISSTREAM_MAX_BUFFER_RECORDS` default `20000`

### AIS SignalR
- `INGEST_ENDPOINT_PATH` should be `/api/v1/ingest/ais/batch`
- `AIS_HOST` required
- `AIS_QUERY` required
- `AIS_DEVICE` optional
- `AIS_ACTION_TYPE` default `1`
- `AIS_USER_ID` default `0`
- `AIS_QUERY_LATEST_BEFORE_STREAM` default `true`
- `AIS_QUERY_MINUTES` default `10`
- `AIS_QUERY_INCREMENTAL` default `true`
- `AIS_USING_LAST_UPDATE_TIME` default `true`
- `AIS_AUTO_TRIGGER` default `true`
- `AIS_AUTO_TRIGGER_INTERVAL_MS` default `15000`
- `AIS_SIGNALR_RECONNECT_DELAY_SECONDS` default `30`
- `AIS_SIGNALR_MAX_BUFFER_RECORDS` default `20000`

## AIS Runbook (Quick)

1. Verify env:
- `API_KEY`, `GATEWAY_URL`, `INGEST_ENDPOINT_PATH=/api/v1/ingest/ais/batch`
- Source-specific required vars (`AISSTREAM_API_KEY` or `AIS_HOST` + `AIS_QUERY`)

2. Start connector:
- `python3 connectors/aisstream_connector.py`
- `python3 connectors/ais_signalr_connector.py`

3. Check logs:
- Expect periodic `... flush raw= deduped= dropped_total= accepted=...`
- `dropped_total` tăng liên tục nghĩa là source vượt khả năng ingest hoặc gateway lỗi kéo dài

4. First diagnostics when no data:
- Confirm `/api/query` response is HTTP 2xx (SignalR)
- Confirm WebSocket subscription accepted (AISStream)
- Check `INGEST_ENDPOINT_PATH` đúng `/api/v1/ingest/ais/batch`

Preflight before live run:

```bash
python3 connectors/smoke_ais_connectors.py --connector both
```

This check validates:
- required env variables and placeholder values
- int/bool config format
- required runtime dependency import
- connector instantiation without opening live stream

## Tests

```bash
python3 -m unittest discover -s connectors/tests -p 'test_*.py'
```

Windows PowerShell with the local venv:

```powershell
.\connectors\run_tests.ps1
```

The test requirements are intentionally smaller than the runtime scraper requirements. They avoid native packages that are not needed for pure unit tests.
