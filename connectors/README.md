# Source Connectors

Standalone connectors that fetch external aircraft feeds and push batches into this platform through:

`POST /api/v1/ingest/adsb/batch`

Available connectors:
- `adsb_hckt_connector.py` -> `ADSB-HCKT`
- `adsbx_connector.py` -> `ADSBX-SNAPSHOT`
- `fr24_connector.py` -> `FR24-GLOBAL`
- `radarbox_connector.py` -> `RADARBOX-GLOBAL`

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

## Run

```bash
python3 connectors/adsb_hckt_connector.py
python3 connectors/fr24_connector.py
python3 connectors/radarbox_connector.py
python3 connectors/adsbx_connector.py
```

## Docker Compose

Runtime compose file:
- [docker-compose-connectors.yml](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/infrastructure/docker-compose-connectors.yml)

Default env files:
- [hckt.env](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/connectors/env/hckt.env)
- [adsbx.env](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/connectors/env/adsbx.env)
- [fr24.env](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/connectors/env/fr24.env)
- [radarbox.env](/mnt/c/Users/NamP7/Documents/workspace/2026/tracking-2026/connectors/env/radarbox.env)

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

## Tests

```bash
python3 -m unittest discover -s connectors/tests -p 'test_*.py'
```

Windows PowerShell with the local venv:

```powershell
.\connectors\run_tests.ps1
```

The test requirements are intentionally smaller than the runtime scraper requirements. They avoid native packages that are not needed for pure unit tests.
