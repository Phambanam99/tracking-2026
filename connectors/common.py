from __future__ import annotations

import json
import logging
import math
import os
import random
import re
import time
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

import requests

RecordDict = Dict[str, Any]
ICAO_HEX_PATTERN = re.compile(r"^[0-9A-F]{6}$")
MMSI_PATTERN = re.compile(r"^\d{9}$")
JSON_DUMPS_KWARGS = {"separators": (",", ":"), "ensure_ascii": True}


class ConnectorConfigurationError(RuntimeError):
    pass


@dataclass(frozen=True)
class GatewayIngestConfig:
    gateway_url: str
    api_key: str
    source_id: str
    endpoint_path: str = "/api/v1/ingest/adsb/batch"
    max_records_per_batch: int = 1000
    target_payload_bytes: int = 220 * 1024
    request_timeout_seconds: int = 10
    retry_attempts: int = 3
    base_retry_delay_seconds: float = 1.0
    send_source_header: bool = True
    verify_tls: bool = True

    @classmethod
    def from_env(cls, default_source_id: str) -> "GatewayIngestConfig":
        gateway_url = os.getenv("GATEWAY_URL", "http://localhost:8080").rstrip("/")
        api_key = os.getenv("API_KEY", "").strip()
        source_id = os.getenv("SOURCE_ID", default_source_id).strip() or default_source_id
        endpoint_path = os.getenv("INGEST_ENDPOINT_PATH", "/api/v1/ingest/adsb/batch").strip() or "/api/v1/ingest/adsb/batch"
        if not api_key:
            raise ConnectorConfigurationError("API_KEY is required.")
        return cls(
            gateway_url=gateway_url,
            api_key=api_key,
            source_id=source_id,
            endpoint_path=endpoint_path,
            max_records_per_batch=int(os.getenv("MAX_RECORDS_PER_BATCH", "1000")),
            target_payload_bytes=int(os.getenv("TARGET_PAYLOAD_BYTES", str(220 * 1024))),
            request_timeout_seconds=int(os.getenv("REQUEST_TIMEOUT_SECONDS", "10")),
            retry_attempts=int(os.getenv("RETRY_ATTEMPTS", "3")),
            base_retry_delay_seconds=float(os.getenv("BASE_RETRY_DELAY_SECONDS", "1.0")),
            send_source_header=os.getenv("SEND_SOURCE_HEADER", "true").lower() not in {"0", "false", "no"},
            verify_tls=os.getenv("VERIFY_TLS", "true").lower() not in {"0", "false", "no"},
        )


@dataclass(frozen=True)
class IngestSummary:
    batches_attempted: int
    batches_accepted: int
    records_attempted: int
    records_accepted: int


class GatewayIngestClient:
    def __init__(self, config: GatewayIngestConfig, logger: Optional[logging.Logger] = None) -> None:
        self.config = config
        self.logger = logger or logging.getLogger(self.__class__.__name__)
        self.session = requests.Session()

    @property
    def ingest_url(self) -> str:
        return f"{self.config.gateway_url}{self.config.endpoint_path}"

    def chunk_records(self, records: Iterable[RecordDict]) -> List[List[RecordDict]]:
        chunks: List[List[RecordDict]] = []
        current: List[RecordDict] = []

        for record in records:
            if not current:
                current = [record]
                continue

            if len(current) >= self.config.max_records_per_batch:
                chunks.append(current)
                current = [record]
                continue

            candidate = current + [record]
            if estimate_payload_bytes(candidate) > self.config.target_payload_bytes:
                chunks.append(current)
                current = [record]
            else:
                current = candidate

        if current:
            chunks.append(current)
        return chunks

    def send_records(self, records: List[RecordDict], request_prefix: str) -> IngestSummary:
        chunks = self.chunk_records(records)
        accepted_batches = 0
        accepted_records = 0

        for index, chunk in enumerate(chunks):
            request_id = build_request_id(request_prefix, index)
            if self._post_chunk(chunk, request_id):
                accepted_batches += 1
                accepted_records += len(chunk)

        return IngestSummary(
            batches_attempted=len(chunks),
            batches_accepted=accepted_batches,
            records_attempted=len(records),
            records_accepted=accepted_records,
        )

    def _post_chunk(self, records: List[RecordDict], request_id: str) -> bool:
        payload = {"records": records}
        try:
            payload_bytes = serialize_payload(payload)
        except ValueError as exc:
            self.logger.error("invalid json payload request_id=%s error=%s", request_id, exc)
            return False
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.config.api_key,
            "x-request-id": request_id,
        }
        if self.config.send_source_header:
            headers["X-Source-Id"] = self.config.source_id

        for attempt in range(1, self.config.retry_attempts + 1):
            try:
                response = self.session.post(
                    self.ingest_url,
                    headers=headers,
                    data=payload_bytes,
                    timeout=self.config.request_timeout_seconds,
                    verify=self.config.verify_tls,
                )
            except requests.RequestException as exc:
                if attempt >= self.config.retry_attempts:
                    self.logger.error("request failed request_id=%s error=%s", request_id, exc)
                    return False
                self._sleep_before_retry(attempt, request_id, f"network error: {exc}")
                continue

            if response.status_code == 202:
                return True

            if response.status_code in {429, 503} and attempt < self.config.retry_attempts:
                self._sleep_before_retry(attempt, request_id, f"status={response.status_code}")
                continue

            self.logger.error(
                "ingest rejected request_id=%s status=%s body=%s",
                request_id,
                response.status_code,
                response.text[:300],
            )
            return False

        return False

    def _sleep_before_retry(self, attempt: int, request_id: str, reason: str) -> None:
        jitter = random.uniform(0.0, 0.25)
        delay = (self.config.base_retry_delay_seconds * (2 ** (attempt - 1))) + jitter
        self.logger.warning("retrying request_id=%s attempt=%s reason=%s delay=%.2fs", request_id, attempt, reason, delay)
        time.sleep(delay)


class BaseConnector:
    def __init__(self, name: str, config: GatewayIngestConfig, refresh_interval_seconds: float) -> None:
        self.name = name
        self.config = config
        self.logger = logging.getLogger(name)
        self.client = GatewayIngestClient(config=config, logger=self.logger)
        self.refresh_interval_seconds = refresh_interval_seconds
        self._running = False

    def collect_records(self) -> List[RecordDict]:
        raise NotImplementedError

    def run_once(self) -> IngestSummary:
        started_at = time.time()
        records = self.collect_records()
        if not records:
            self.logger.info("no records collected")
            return IngestSummary(0, 0, 0, 0)

        summary = self.client.send_records(records, request_prefix=self.config.source_id.lower())
        elapsed = time.time() - started_at
        self.logger.info(
            "cycle done source=%s records=%s accepted=%s/%s batches=%s/%s duration=%.2fs",
            self.config.source_id,
            len(records),
            summary.records_accepted,
            summary.records_attempted,
            summary.batches_accepted,
            summary.batches_attempted,
            elapsed,
        )
        return summary

    def run_forever(self) -> None:
        self._running = True
        self.logger.info("starting connector source=%s interval=%.2fs", self.config.source_id, self.refresh_interval_seconds)
        while self._running:
            try:
                self.run_once()
            except KeyboardInterrupt:
                self._running = False
                raise
            except Exception as exc:  # pragma: no cover - runtime guardrail
                self.logger.exception("collector loop failed: %s", exc)
            time.sleep(self.refresh_interval_seconds)

    def stop(self) -> None:
        self._running = False


def configure_logging(default_level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, os.getenv("LOG_LEVEL", default_level).upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


def build_request_id(prefix: str, batch_index: int) -> str:
    return f"{prefix}-{int(time.time() * 1000)}-{batch_index}"


def estimate_payload_bytes(records: List[RecordDict]) -> int:
    return len(serialize_payload({"records": records}))


def serialize_payload(payload: Dict[str, Any]) -> bytes:
    return json.dumps(payload, allow_nan=False, **JSON_DUMPS_KWARGS).encode("utf-8")


def normalize_hex_icao(value: Any) -> Optional[str]:
    if value is None:
        return None
    normalized = str(value).strip().upper()
    if ICAO_HEX_PATTERN.fullmatch(normalized):
        return normalized
    return None


def normalize_mmsi(value: Any) -> Optional[str]:
    if value is None:
        return None
    normalized = str(value).strip()
    if MMSI_PATTERN.fullmatch(normalized):
        return normalized
    return None


def normalize_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def normalize_heading(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        heading = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(heading):
        return None
    if not (0.0 <= heading <= 360.0):
        return None
    return round(heading, 1)


def normalize_positive_int(value: Any, max_value: int = 2_147_483_647) -> Optional[int]:
    if value is None:
        return None
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        return None
    return number if 0 <= number <= max_value else None


def normalize_positive_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number < 0 or not math.isfinite(number):
        return None
    return round(number, 1)


def validate_lat_lon(lat: Any, lon: Any) -> Optional[tuple[float, float]]:
    try:
        lat_value = float(lat)
        lon_value = float(lon)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(lat_value) or not math.isfinite(lon_value):
        return None
    if not (-90.0 <= lat_value <= 90.0 and -180.0 <= lon_value <= 180.0):
        return None
    return round(lat_value, 6), round(lon_value, 6)


def epoch_ms_from_seconds(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        seconds = int(float(value))
    except (TypeError, ValueError):
        return None
    return seconds * 1000 if seconds > 0 else None


def epoch_ms_from_maybe_seconds_or_ms(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        numeric = int(float(value))
    except (TypeError, ValueError):
        return None
    if numeric <= 0:
        return None
    return numeric if numeric >= 1_000_000_000_000 else numeric * 1000


def parse_event_time_ms(value: Any) -> Optional[int]:
    numeric = epoch_ms_from_maybe_seconds_or_ms(value)
    if numeric is not None:
        return numeric

    text = normalize_text(value)
    if text is None:
        return None

    normalized = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int(parsed.timestamp() * 1000)


def convert_gmt7_to_utc(raw_timestamp: Any) -> Optional[datetime]:
    text = normalize_text(raw_timestamp)
    if text is None:
        return None
    if text.endswith("Z"):
        text = text[:-1]

    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None

    gmt7 = timezone(timedelta(hours=7))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=gmt7)
    return parsed.astimezone(timezone.utc)


def completeness_score(record: RecordDict) -> int:
    fields = ("altitude", "speed", "heading")
    return sum(1 for field in fields if record.get(field) is not None)


def completeness_score_ais(record: RecordDict) -> int:
    fields = ("vessel_name", "speed", "course", "heading", "nav_status")
    return sum(1 for field in fields if record.get(field) is not None)


def dedupe_records(
    records: List[RecordDict],
    key_fields: tuple[str, ...] = ("mmsi", "event_time", "lat", "lon", "source_id"),
) -> List[RecordDict]:
    seen: set[tuple[Any, ...]] = set()
    deduped: List[RecordDict] = []
    for record in records:
        dedupe_key = tuple(record.get(field) for field in key_fields)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        deduped.append(record)
    return deduped
