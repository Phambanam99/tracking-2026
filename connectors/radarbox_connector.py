from __future__ import annotations

import os
import struct
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests

try:
    import brotli  # type: ignore
except ImportError:  # pragma: no cover
    brotli = None

try:
    from connectors.common import (
        BaseConnector,
        GatewayIngestConfig,
        configure_logging,
        epoch_ms_from_maybe_seconds_or_ms,
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
        epoch_ms_from_maybe_seconds_or_ms,
        normalize_heading,
        normalize_hex_icao,
        normalize_positive_float,
        normalize_positive_int,
        validate_lat_lon,
    )


RADARBOX_URL = "https://live.airnavradar.com/Flights/GetFlights"
RADARBOX_HEADERS = {
    "content-type": "application/grpc-web+proto",
    "origin": "https://www.airnavradar.com",
    "referer": "https://www.airnavradar.com/",
    "user-agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"
    ),
    "x-grpc-web": "1",
    "accept-encoding": "gzip, deflate, br",
}

WIRETYPE_VARINT = 0
WIRETYPE_FIXED64 = 1
WIRETYPE_LENGTH_DELIMITED = 2
WIRETYPE_FIXED32 = 5

SCHEMA_LIVE_FLIGHT: Dict[int, Dict[str, Any]] = {
    1: {"name": "fid", "type": "int64"},
    2: {"name": "fn", "type": "string"},
    3: {"name": "la", "type": "float"},
    4: {"name": "lo", "type": "float"},
    5: {"name": "t", "type": "int64"},
    6: {"name": "alt", "type": "int32"},
    7: {"name": "act", "type": "string"},
    8: {"name": "gs", "type": "int32"},
    9: {"name": "hd", "type": "int32"},
    11: {"name": "so", "type": "string"},
    12: {"name": "acr", "type": "string"},
    13: {"name": "ms", "type": "string"},
    14: {"name": "org", "type": "string"},
    15: {"name": "dst", "type": "string"},
    16: {"name": "al", "type": "string"},
    17: {"name": "vs", "type": "int32"},
    18: {"name": "ground", "type": "bool"},
    19: {"name": "sq", "type": "int32"},
    33: {"name": "cs", "type": "string"},
}
SCHEMA_ROOT = {1: {"name": "flights", "repeat": True, "sub": SCHEMA_LIVE_FLIGHT}}


class RadarBoxConnector(BaseConnector):
    def __init__(self, config: GatewayIngestConfig) -> None:
        refresh_interval_seconds = float(os.getenv("RADARBOX_REFRESH_INTERVAL_SECONDS", "10"))
        super().__init__(name="RADARBOX-GLOBAL", config=config, refresh_interval_seconds=refresh_interval_seconds)
        self.session = requests.Session()
        self.timeout_seconds = int(os.getenv("RADARBOX_TIMEOUT_SECONDS", "30"))
        self.speed_unit = os.getenv("RADARBOX_SPEED_UNIT", "knots").lower()

    def collect_records(self) -> List[Dict[str, Any]]:
        flights = self.fetch_flights()
        records: List[Dict[str, Any]] = []
        for flight in flights:
            record = transform_radarbox_flight(flight, speed_unit=self.speed_unit)
            if record is not None:
                records.append(record)
        return records

    def fetch_flights(self) -> List[Dict[str, Any]]:
        payload = wrap_grpc_web(
            build_flights_query(
                sources=["adsb", "adsbsat", "asdi", "ocea", "mlat", "sate", "uat", "hfdl", "esti", "asdex", "flarm", "aust"],
                filters={
                    "zoom": "5",
                    "designator": "iata",
                    "tz": "local",
                    "os": "web",
                    "class": "?,A,B,C,G,H,M",
                    "durationFrom": "0",
                    "durationTo": "14",
                    "distanceFrom": "0",
                    "distanceTo": "16000",
                    "projType": "EPSG:3857",
                },
                options=["showLastTrails", "vehicles", "ground", "onair"],
            ),
        )

        response = self.session.post(
            RADARBOX_URL,
            headers=RADARBOX_HEADERS,
            data=payload,
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        content = maybe_decompress(response.content, response.headers.get("content-encoding", ""))
        frames = unwrap_grpc_web(content)

        flights: List[Dict[str, Any]] = []
        for flag, data in frames:
            if flag != 0:
                continue
            decoded = decode_proto_message(data, SCHEMA_ROOT)
            flights.extend(decoded.get("flights", []))
        return flights


def transform_radarbox_flight(flight: Dict[str, Any], speed_unit: str = "knots") -> Optional[Dict[str, Any]]:
    icao = normalize_hex_icao(flight.get("ms"))
    if icao is None:
        return None

    coords = validate_lat_lon(flight.get("la"), flight.get("lo"))
    if coords is None:
        return None
    lat, lon = coords

    event_time = epoch_ms_from_maybe_seconds_or_ms(flight.get("t"))
    if event_time is None:
        return None

    record: Dict[str, Any] = {
        "icao": icao,
        "lat": lat,
        "lon": lon,
        "event_time": event_time,
        "source_id": "RADARBOX-GLOBAL",
    }

    altitude = normalize_positive_int(flight.get("alt"))
    if altitude is not None:
        record["altitude"] = altitude

    speed = normalize_positive_float(flight.get("gs"))
    if speed is not None:
        if speed_unit == "knots":
            speed = round(speed * 1.852, 1)
        record["speed"] = speed

    heading = normalize_heading(flight.get("hd"))
    if heading is not None:
        record["heading"] = heading

    aircraft_type = str(flight.get("act", "")).strip().upper()
    if aircraft_type:
        record["aircraft_type"] = aircraft_type

    return record


def maybe_decompress(payload: bytes, encoding: str) -> bytes:
    if encoding == "br" and brotli is not None:
        try:
            return brotli.decompress(payload)
        except brotli.error:
            return payload
    return payload


def encode_varint(value: int) -> bytes:
    remaining = value
    parts = bytearray()
    while remaining > 127:
        parts.append((remaining & 0x7F) | 0x80)
        remaining >>= 7
    parts.append(remaining & 0x7F)
    return bytes(parts)


def decode_varint(data: bytes, pos: int) -> Tuple[int, int]:
    result = 0
    shift = 0
    while True:
        current = data[pos]
        result |= (current & 0x7F) << shift
        pos += 1
        if (current & 0x80) == 0:
            return result, pos
        shift += 7


def build_key_value(key: str, value: str) -> bytes:
    key_bytes = key.encode("utf-8")
    value_bytes = value.encode("utf-8")
    return b"".join(
        [
            encode_varint((1 << 3) | WIRETYPE_LENGTH_DELIMITED),
            encode_varint(len(key_bytes)),
            key_bytes,
            encode_varint((2 << 3) | WIRETYPE_LENGTH_DELIMITED),
            encode_varint(len(value_bytes)),
            value_bytes,
        ],
    )


def build_flights_query(sources: Iterable[str], filters: Dict[str, str], options: Iterable[str]) -> bytes:
    parts: List[bytes] = []
    for source in sources:
        encoded = source.encode("utf-8")
        parts.extend([encode_varint((1 << 3) | WIRETYPE_LENGTH_DELIMITED), encode_varint(len(encoded)), encoded])
    for key, value in filters.items():
        kv = build_key_value(key, value)
        parts.extend([encode_varint((2 << 3) | WIRETYPE_LENGTH_DELIMITED), encode_varint(len(kv)), kv])
    for option in options:
        encoded = option.encode("utf-8")
        parts.extend([encode_varint((3 << 3) | WIRETYPE_LENGTH_DELIMITED), encode_varint(len(encoded)), encoded])
    return b"".join(parts)


def wrap_grpc_web(data: bytes) -> bytes:
    return bytes([0]) + len(data).to_bytes(4, byteorder="big") + data


def unwrap_grpc_web(data: bytes) -> List[Tuple[int, bytes]]:
    frames: List[Tuple[int, bytes]] = []
    pos = 0
    while pos + 5 <= len(data):
        flag = data[pos]
        length = int.from_bytes(data[pos + 1 : pos + 5], byteorder="big")
        pos += 5
        frame = data[pos : pos + length]
        frames.append((flag, frame))
        pos += length
    return frames


def decode_proto_message(data: bytes, schema: Dict[int, Dict[str, Any]]) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    pos = 0
    end = len(data)

    while pos < end:
        try:
            tag, pos = decode_varint(data, pos)
        except IndexError:
            break

        field_no = tag >> 3
        wire_type = tag & 0x07
        field_info = schema.get(field_no, {})
        field_name = field_info.get("name", f"field_{field_no}")

        try:
            if wire_type == WIRETYPE_VARINT:
                value, pos = decode_varint(data, pos)
                if field_info.get("type") == "bool":
                    value = bool(value)
            elif wire_type == WIRETYPE_FIXED64:
                value = struct.unpack_from("<q", data, pos)[0]
                pos += 8
            elif wire_type == WIRETYPE_FIXED32:
                value = struct.unpack_from("<f", data, pos)[0]
                pos += 4
            elif wire_type == WIRETYPE_LENGTH_DELIMITED:
                length, pos = decode_varint(data, pos)
                body = data[pos : pos + length]
                pos += length
                if "sub" in field_info:
                    value = decode_proto_message(body, field_info["sub"])
                elif field_info.get("type") == "string":
                    value = body.decode("utf-8", errors="replace")
                else:
                    value = body
            else:
                break
        except Exception:
            break

        if field_info.get("repeat"):
            result.setdefault(field_name, []).append(value)
        else:
            result[field_name] = value

    return result


def main() -> None:
    configure_logging()
    config = GatewayIngestConfig.from_env(default_source_id="RADARBOX-GLOBAL")
    connector = RadarBoxConnector(config)
    connector.run_forever()


if __name__ == "__main__":
    main()
