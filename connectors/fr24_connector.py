from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

import requests

try:
    from connectors.common import (
        BaseConnector,
        GatewayIngestConfig,
        completeness_score,
        configure_logging,
        epoch_ms_from_seconds,
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
        completeness_score,
        configure_logging,
        epoch_ms_from_seconds,
        normalize_heading,
        normalize_hex_icao,
        normalize_positive_float,
        normalize_positive_int,
        validate_lat_lon,
    )

FR24_URL = "https://data-cloud.flightradar24.com/zones/fcgi/feed.js"
FR24_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.flightradar24.com/",
    "Origin": "https://www.flightradar24.com",
}
FR24_QUERY_PARAMS = {
    "faa": "1",
    "satellite": "1",
    "mlat": "1",
    "flarm": "1",
    "adsb": "1",
    "gnd": "0",
    "air": "1",
    "vehicles": "0",
    "estimated": "1",
    "maxage": "14400",
}


@dataclass(frozen=True)
class Zone:
    name: str
    bounds: str
    priority: bool


DEFAULT_ZONES: List[Zone] = [
    Zone("VN - North West", "23.5,21,102,105", True),
    Zone("VN - North East", "23.5,21,105,108", True),
    Zone("VN - Red River Delta", "21.5,19.5,105,107.5", True),
    Zone("VN - North Central", "20,17,104,107", True),
    Zone("VN - Central (Da Nang)", "17,14,107,110", True),
    Zone("VN - Central Highlands", "15,11,107,109", True),
    Zone("VN - South Central Coast", "14,10.5,108.5,110", True),
    Zone("VN - SE (HCM City)", "12,10,105.5,108", True),
    Zone("VN - Mekong Delta", "11,8,104,106.5", True),
    Zone("Gulf of Tonkin", "22,17.5,105.5,110", True),
    Zone("Gulf of Thailand", "13,6,99,105", True),
    Zone("Paracel Islands", "18,15,110,115", True),
    Zone("Spratly Islands - North", "12,9,110,118", True),
    Zone("Spratly Islands - South", "9,4,110,119", True),
    Zone("SCS - North West", "26,18,110,116", True),
    Zone("SCS - North East", "26,18,116,122", True),
    Zone("SCS - Central West", "18,12,110,116", True),
    Zone("SCS - Central East", "18,12,116,122", True),
    Zone("SCS - South West", "12,3,104,112", True),
    Zone("SCS - South East", "12,3,112,120", True),
    Zone("Taiwan Strait", "26,21,117,122", True),
    Zone("Luzon Strait", "22,17,118,124", True),
    Zone("North America", "90,15,-170,-50", False),
    Zone("South America", "15,-60,-90,-30", False),
    Zone("Europe - NW", "72,50,-15,15", False),
    Zone("Europe - SW", "50,35,-15,15", False),
    Zone("Europe - East", "72,35,15,50", False),
    Zone("Africa", "40,-40,-20,55", False),
    Zone("Middle East", "45,10,25,65", False),
    Zone("Asia - North (West)", "75,30,60,105", False),
    Zone("Asia - North (East)", "75,30,105,150", False),
    Zone("Asia - South (West)", "30,5,65,95", False),
    Zone("Asia - South (East)", "30,5,95,130", False),
    Zone("SE Asia", "25,-15,90,155", False),
    Zone("Oceania", "0,-50,110,180", False),
    Zone("Atlantic", "70,-10,-60,0", False),
    Zone("Pacific", "60,-50,150,-100", False),
]


class Flightradar24Connector(BaseConnector):
    def __init__(self, config: GatewayIngestConfig) -> None:
        refresh_interval_seconds = float(os.getenv("FR24_REFRESH_INTERVAL_SECONDS", "60"))
        super().__init__(name="FR24-GLOBAL", config=config, refresh_interval_seconds=refresh_interval_seconds)
        self.session = requests.Session()
        self.max_concurrent_requests = int(os.getenv("FR24_MAX_CONCURRENT_REQUESTS", "5"))
        self.timeout_seconds = int(os.getenv("FR24_TIMEOUT_SECONDS", "10"))
        self.zones = DEFAULT_ZONES
        self.homepage_url = os.getenv("FR24_HOMEPAGE_URL", "https://www.flightradar24.com/")
        self.cookie_header = os.getenv("FR24_COOKIE", "").strip()
        self.proxy_url = os.getenv("FR24_PROXY_URL", "").strip()
        if self.cookie_header:
            self.session.headers["Cookie"] = self.cookie_header
        if self.proxy_url:
            self.session.proxies.update({"http": self.proxy_url, "https": self.proxy_url})

    def collect_records(self) -> List[Dict[str, Any]]:
        self._warm_session()
        merged: Dict[str, Dict[str, Any]] = {}
        with ThreadPoolExecutor(max_workers=self.max_concurrent_requests) as executor:
            for zone_result in executor.map(self.fetch_zone, self.zones):
                if not zone_result:
                    continue
                zone, aircraft_map = zone_result
                for value in aircraft_map.values():
                    candidate = transform_fr24_entry(value, zone.priority)
                    if candidate is None:
                        continue
                    current = merged.get(candidate["icao"])
                    merged[candidate["icao"]] = merge_fr24_candidate(current, candidate)
        return list(merged.values())

    def _warm_session(self) -> None:
        try:
            self.session.get(self.homepage_url, headers=FR24_HEADERS, timeout=self.timeout_seconds)
        except requests.RequestException as exc:
            self.logger.debug("homepage warmup failed error=%s", exc)

    def fetch_zone(self, zone: Zone) -> Optional[tuple[Zone, Dict[str, Any]]]:
        params = dict(FR24_QUERY_PARAMS)
        params["bounds"] = zone.bounds
        try:
            response = self.session.get(
                FR24_URL,
                params=params,
                headers=FR24_HEADERS,
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            self.logger.warning("zone fetch failed zone=%s error=%s", zone.name, exc)
            return None

        try:
            raw = response.json()
        except ValueError as exc:
            self.logger.warning("zone json decode failed zone=%s error=%s", zone.name, exc)
            return None

        aircraft: Dict[str, Any] = {}
        for key, value in raw.items():
            if key in {"full_count", "version", "stats"}:
                continue
            if isinstance(value, list):
                aircraft[key] = value
        return zone, aircraft


def transform_fr24_entry(value: Iterable[Any], priority: bool) -> Optional[Dict[str, Any]]:
    if not isinstance(value, list) or len(value) < 11:
        return None

    icao = normalize_hex_icao(value[0])
    if icao is None:
        return None

    coords = validate_lat_lon(value[1], value[2])
    if coords is None:
        return None
    lat, lon = coords

    event_time = epoch_ms_from_seconds(value[10])
    if event_time is None:
        return None

    candidate: Dict[str, Any] = {
        "icao": icao,
        "lat": lat,
        "lon": lon,
        "event_time": event_time,
        "source_id": "FR24-GLOBAL",
        "_priority": 1 if priority else 0,
    }

    altitude = normalize_positive_int(value[4] if len(value) > 4 else None)
    if altitude is not None:
        candidate["altitude"] = altitude

    speed_knots = normalize_positive_float(value[5] if len(value) > 5 else None)
    if speed_knots is not None:
        candidate["speed"] = round(speed_knots * 1.852, 1)

    heading = normalize_heading(value[3] if len(value) > 3 else None)
    if heading is not None:
        candidate["heading"] = heading

    aircraft_type = str(value[8] if len(value) > 8 else "").strip().upper()
    if aircraft_type:
        candidate["aircraft_type"] = aircraft_type

    return candidate


def merge_fr24_candidate(
    current: Optional[Dict[str, Any]],
    candidate: Dict[str, Any],
) -> Dict[str, Any]:
    if current is None:
        return candidate

    current_event = int(current["event_time"])
    candidate_event = int(candidate["event_time"])
    if candidate_event > current_event:
        return candidate
    if candidate_event < current_event:
        return current

    candidate_score = completeness_score(candidate)
    current_score = completeness_score(current)
    if candidate_score > current_score:
        return candidate
    if candidate_score < current_score:
        return current

    if int(candidate.get("_priority", 0)) > int(current.get("_priority", 0)):
        return candidate
    return current


def main() -> None:
    configure_logging()
    config = GatewayIngestConfig.from_env(default_source_id="FR24-GLOBAL")
    connector = Flightradar24Connector(config)
    connector.run_forever()


if __name__ == "__main__":
    main()
