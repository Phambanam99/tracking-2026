from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import requests

try:
    from connectors.common import (
        BaseConnector,
        GatewayIngestConfig,
        configure_logging,
        normalize_heading,
        normalize_hex_icao,
        normalize_positive_float,
        normalize_positive_int,
        validate_lat_lon,
    )
except ImportError:  # pragma: no cover
    from common import (  # type: ignore
        BaseConnector,
        GatewayIngestConfig,
        configure_logging,
        normalize_heading,
        normalize_hex_icao,
        normalize_positive_float,
        normalize_positive_int,
        validate_lat_lon,
    )


DEFAULT_HCKT_URL = "http://100.100.24.4/tar1090/data/aircraft.json"
KNOTS_TO_KMH = 1.852


class AdsbHcktConnector(BaseConnector):
    def __init__(self, config: GatewayIngestConfig) -> None:
        refresh_interval_seconds = float(os.getenv("ADSB_HCKT_REFRESH_INTERVAL_SECONDS", "3"))
        super().__init__(name="ADSB-HCKT", config=config, refresh_interval_seconds=refresh_interval_seconds)
        self.session = requests.Session()
        self.url = os.getenv("ADSB_HCKT_URL", DEFAULT_HCKT_URL).strip() or DEFAULT_HCKT_URL
        self.timeout_seconds = int(os.getenv("ADSB_HCKT_TIMEOUT_SECONDS", "10"))
        self.max_seen_seconds = float(os.getenv("ADSB_HCKT_MAX_SEEN_SECONDS", "15"))

    def collect_records(self) -> List[Dict[str, Any]]:
        response = self.session.get(self.url, timeout=self.timeout_seconds)
        response.raise_for_status()
        payload = response.json()
        return transform_hckt_payload(
            payload,
            source_id=self.config.source_id,
            max_seen_seconds=self.max_seen_seconds,
        )


def transform_hckt_payload(
    payload: Dict[str, Any],
    source_id: str,
    max_seen_seconds: Optional[float] = None,
) -> List[Dict[str, Any]]:
    snapshot_now = payload.get("now")
    try:
        snapshot_ms = int(float(snapshot_now) * 1000)
    except (TypeError, ValueError):
        snapshot_ms = 0

    aircraft = payload.get("aircraft")
    if not isinstance(aircraft, list):
        return []

    records: List[Dict[str, Any]] = []
    for entry in aircraft:
        if not isinstance(entry, dict):
            continue
        record = transform_hckt_aircraft(
            entry,
            snapshot_ms=snapshot_ms,
            source_id=source_id,
            max_seen_seconds=max_seen_seconds,
        )
        if record is not None:
            records.append(record)
    return records


def transform_hckt_aircraft(
    entry: Dict[str, Any],
    snapshot_ms: int,
    source_id: str,
    max_seen_seconds: Optional[float] = None,
) -> Optional[Dict[str, Any]]:
    icao = normalize_hex_icao(entry.get("hex"))
    if icao is None:
        return None

    coords = validate_lat_lon(entry.get("lat"), entry.get("lon"))
    if coords is None:
        return None
    lat, lon = coords

    age_seconds = _resolve_position_age_seconds(entry)
    if max_seen_seconds is not None and age_seconds is not None and age_seconds > max_seen_seconds:
        return None

    event_time = snapshot_ms
    if snapshot_ms > 0 and age_seconds is not None:
        event_time = max(snapshot_ms - int(age_seconds * 1000), 1)
    if event_time <= 0:
        return None

    record: Dict[str, Any] = {
        "icao": icao,
        "lat": lat,
        "lon": lon,
        "event_time": event_time,
        "source_id": source_id,
    }

    altitude = normalize_positive_int(entry.get("alt_baro"))
    if altitude is None:
        altitude = normalize_positive_int(entry.get("alt_geom"))
    if altitude is not None:
        record["altitude"] = altitude

    speed_knots = normalize_positive_float(entry.get("gs"))
    if speed_knots is not None:
        record["speed"] = round(speed_knots * KNOTS_TO_KMH, 1)

    heading = normalize_heading(entry.get("track"))
    if heading is not None:
        record["heading"] = heading

    aircraft_type = str(entry.get("t", "")).strip().upper()
    if aircraft_type:
        record["aircraft_type"] = aircraft_type

    return record


def _resolve_position_age_seconds(entry: Dict[str, Any]) -> Optional[float]:
    for field in ("seen_pos", "seen"):
        value = entry.get(field)
        try:
            age_seconds = float(value)
        except (TypeError, ValueError):
            continue
        if age_seconds >= 0:
            return age_seconds
    return None


def main() -> None:
    configure_logging()
    config = GatewayIngestConfig.from_env(default_source_id="ADSB-HCKT")
    connector = AdsbHcktConnector(config)
    connector.run_forever()


if __name__ == "__main__":
    main()
