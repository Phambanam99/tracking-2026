from __future__ import annotations

import os
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlencode

import requests

try:
    from connectors.common import (
        BaseConnector,
        dedupe_records,
        GatewayIngestConfig,
        IngestSummary,
        configure_logging,
        convert_gmt7_to_utc,
        normalize_heading,
        normalize_mmsi,
        normalize_positive_float,
        normalize_text,
        validate_lat_lon,
    )
except ImportError:  # pragma: no cover
    from common import (  # type: ignore
        BaseConnector,
        dedupe_records,
        GatewayIngestConfig,
        IngestSummary,
        configure_logging,
        convert_gmt7_to_utc,
        normalize_heading,
        normalize_mmsi,
        normalize_positive_float,
        normalize_text,
        validate_lat_lon,
    )

MAX_SIGNALR_BATCH_SIZE = 10_000


def _pick_value(record: Dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in record and record.get(key) is not None:
            return record.get(key)
    return None


def build_dynamic_query(
    static_query: str,
    query_minutes: int,
    last_lower_bound: Optional[datetime],
    incremental: bool,
    now_utc: Optional[datetime] = None,
) -> Tuple[str, datetime]:
    if now_utc is None:
        now_utc = datetime.now(timezone.utc)

    if incremental and last_lower_bound is not None:
        lower = last_lower_bound
    else:
        lower = now_utc - timedelta(minutes=query_minutes)

    lower = lower.astimezone(timezone.utc).replace(second=0, microsecond=0)
    gmt7_time = lower + timedelta(hours=7)

    bracket_idx = static_query.find("[")
    tail = static_query[bracket_idx:] if bracket_idx != -1 else ""
    query = (
        f"(updatetime >= DateTime({gmt7_time.year}, {gmt7_time.month}, {gmt7_time.day}, "
        f"{gmt7_time.hour}, {gmt7_time.minute}, 0)){tail}"
    )
    return query, lower


def transform_signalr_record(record: Dict[str, Any], source_id: str) -> Optional[Dict[str, Any]]:
    mmsi = normalize_mmsi(
        _pick_value(
            record,
            "mmsi",
            "MMSI",
            "userId",
            "UserId",
            "userid",
            "UserID",
            "shipMMSI",
            "ShipMMSI",
        )
    )
    coords = validate_lat_lon(
        _pick_value(record, "lat", "Lat", "latitude", "Latitude", "LAT"),
        _pick_value(record, "lon", "Lon", "lng", "Lng", "longitude", "Longitude", "LON"),
    )
    if mmsi is None or coords is None:
        return None
    lat, lon = coords
    if lat == 0.0 and lon == 0.0:
        return None

    event_timestamp = convert_gmt7_to_utc(
        _pick_value(
            record,
            "updatetime",
            "updateTime",
            "UpdateTime",
            "timestamp",
            "Timestamp",
            "time",
            "Time",
            "eventTime",
            "EventTime",
        )
    )
    if event_timestamp is None:
        return None

    normalized: Dict[str, Any] = {
        "mmsi": mmsi,
        "lat": lat,
        "lon": lon,
        "event_time": int(event_timestamp.timestamp() * 1000),
        "source_id": source_id,
    }
    upstream_source = normalize_text(
        _pick_value(
            record,
            "source",
            "Source",
            "provider",
            "Provider",
            "sourceId",
            "SourceId",
            "source_id",
            "SOURCE_ID",
            "dataSource",
            "DataSource",
            "upstreamSource",
            "UpstreamSource",
        )
    )
    normalized["upstream_source"] = upstream_source or normalize_text(source_id)

    vessel_name = normalize_text(_pick_value(record, "shipName", "ShipName", "name", "Name", "vesselName"))
    if vessel_name is not None:
        normalized["vessel_name"] = vessel_name

    speed = normalize_positive_float(_pick_value(record, "speed", "Speed", "sog", "Sog", "SOG"))
    if speed is not None:
        normalized["speed"] = speed

    course = normalize_heading(_pick_value(record, "course", "Course", "cog", "Cog", "COG"))
    if course is not None:
        normalized["course"] = course

    heading = normalize_heading(_pick_value(record, "heading", "Heading", "trueHeading", "TrueHeading"))
    if heading is not None:
        normalized["heading"] = heading

    return normalized


def transform_signalr_batch(
    rows: Any,
    source_id: str,
    max_batch_size: int = MAX_SIGNALR_BATCH_SIZE,
) -> Tuple[List[Dict[str, Any]], Optional[datetime]]:
    if not isinstance(rows, list):
        return [], None

    limited_rows = rows[:max_batch_size]
    transformed: List[Dict[str, Any]] = []
    max_ts: Optional[datetime] = None

    for row in limited_rows:
        if not isinstance(row, dict):
            continue
        normalized = transform_signalr_record(row, source_id)
        if normalized is None:
            continue
        transformed.append(normalized)
        current_ts = datetime.fromtimestamp(normalized["event_time"] / 1000, tz=timezone.utc)
        if max_ts is None or current_ts > max_ts:
            max_ts = current_ts

    return transformed, max_ts


def unwrap_signalr_query_data_payload(payload: Any) -> Any:
    # signalrcore thường gọi callback với "arguments", nên có thể nhận [[records]]
    if isinstance(payload, list) and len(payload) == 1 and isinstance(payload[0], list):
        return payload[0]
    if isinstance(payload, dict):
        for key in ("data", "records", "arguments", "args"):
            value = payload.get(key)
            if isinstance(value, list):
                if len(value) == 1 and isinstance(value[0], list):
                    return value[0]
                return value
    return payload


class AisSignalrConnector(BaseConnector):
    """AIS SignalR connector - query trigger + event stream ingestion."""

    def __init__(self, config: GatewayIngestConfig) -> None:
        refresh_interval_seconds = float(os.getenv("AIS_SIGNALR_RECONNECT_DELAY_SECONDS", "30"))
        super().__init__(name="AIS-SIGNALR", config=config, refresh_interval_seconds=refresh_interval_seconds)
        self.session = requests.Session()
        self.ais_host = os.getenv("AIS_HOST", "").strip().rstrip("/")
        self.ais_device = os.getenv("AIS_DEVICE", "").strip()
        self.ais_action_type = os.getenv("AIS_ACTION_TYPE", "Offline").strip() or "Offline"
        self.ais_query = os.getenv("AIS_QUERY", "").strip()
        self.ais_user_id = int(os.getenv("AIS_USER_ID", "0"))
        self.ais_query_latest_before_stream = os.getenv("AIS_QUERY_LATEST_BEFORE_STREAM", "true")
        self.ais_query_minutes = int(os.getenv("AIS_QUERY_MINUTES", "240"))
        self.ais_query_incremental = self._as_bool(os.getenv("AIS_QUERY_INCREMENTAL", "true"))
        self.ais_using_last_update_time = self._as_bool(os.getenv("AIS_USING_LAST_UPDATE_TIME", "true"))
        self.ais_auto_trigger = self._as_bool(os.getenv("AIS_AUTO_TRIGGER", "false"))
        self.ais_auto_trigger_interval_ms = int(os.getenv("AIS_AUTO_TRIGGER_INTERVAL_MS", "6000"))
        self.signalr_loop_sleep_seconds = float(os.getenv("AIS_SIGNALR_LOOP_SLEEP_SECONDS", "0.2"))
        self.max_buffer_records = int(os.getenv("AIS_SIGNALR_MAX_BUFFER_RECORDS", "20000"))

        self._last_lower_bound: Optional[datetime] = None
        self._buffer: List[Dict[str, Any]] = []
        self._buffer_lock = threading.Lock()
        self._last_flush_at = time.monotonic()
        self._last_trigger_at = 0.0
        self._connection: Any = None
        self._dropped_records = 0
        self._deduped_records = 0

    def collect_records(self) -> List[Dict[str, Any]]:
        raise NotImplementedError("AIS SignalR connector is event-driven; use run_once()/run_forever().")

    def run_once(self) -> IngestSummary:
        if not self.ais_host:
            raise RuntimeError("AIS_HOST is required.")
        if not self.ais_query:
            raise RuntimeError("AIS_QUERY is required.")

        summary = IngestSummary(0, 0, 0, 0)
        self._connection = self._create_signalr_connection(self._build_hub_url())
        self._register_handlers()
        self._start_connection()
        self.logger.info("connected ais signalr host=%s", self.ais_host)

        try:
            while self._running:
                if self.ais_auto_trigger:
                    now_monotonic = time.monotonic()
                    if now_monotonic - self._last_trigger_at >= (self.ais_auto_trigger_interval_ms / 1000.0):
                        self.trigger_query()
                        self._last_trigger_at = now_monotonic

                summary = self._merge_summaries(summary, self._flush_if_interval_elapsed())
                time.sleep(self.signalr_loop_sleep_seconds)
        finally:
            summary = self._merge_summaries(summary, self._flush_buffer())
            self._stop_connection()
        return summary

    def run_forever(self) -> None:
        self._running = True
        self.logger.info("starting connector source=%s host=%s", self.config.source_id, self.ais_host)
        reconnect_attempt = 0
        while self._running:
            try:
                self.run_once()
                reconnect_attempt = 0
            except KeyboardInterrupt:
                self._running = False
                raise
            except Exception as exc:
                reconnect_attempt += 1
                delay = min(self.refresh_interval_seconds * (2 ** (reconnect_attempt - 1)), 60.0)
                self.logger.warning("signalr session failed error=%s reconnect_in=%.1fs", exc, delay)
                time.sleep(delay)

    def stop(self) -> None:
        self._running = False
        self._stop_connection()

    def trigger_query(self, force_static: bool = False) -> Any:
        if self._connection is None:
            raise RuntimeError("SignalR connection is not ready.")
        connection_id = self._get_connection_id()
        if not connection_id:
            raise RuntimeError("SignalR connection id is missing.")

        query = self.ais_query
        if not force_static:
            query, lower_bound = build_dynamic_query(
                static_query=self.ais_query,
                query_minutes=self.ais_query_minutes,
                last_lower_bound=self._last_lower_bound,
                incremental=self.ais_query_incremental,
            )
            if not self.ais_query_incremental or self._last_lower_bound is None:
                self._last_lower_bound = lower_bound

        body = {
            "ConnectionId": connection_id,
            "UserId": self.ais_user_id,
            "Query": query,
            "UsingLastUpdateTime": self.ais_using_last_update_time,
        }
        response = self.session.post(
            f"{self.ais_host}/api/query",
            json=body,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        response.raise_for_status()
        payload: Any = True
        if response.content:
            try:
                payload = response.json()
            except ValueError:
                payload = response.text
        self.logger.info("signalr query trigger status=%s", response.status_code)

        # Fallback: một số backend trả trực tiếp dữ liệu từ /api/query thay vì push qua hub events.
        rows = unwrap_signalr_query_data_payload(payload)
        if isinstance(rows, list):
            self.logger.info("signalr query trigger inline payload rows=%s", len(rows))
            self._on_query_data(rows)
        return payload

    def _register_handlers(self) -> None:
        self._connection.on("QueryData", self._on_query_data)
        self._connection.on("QueryCount", lambda *_args: None)
        self._connection.on("QueryEnd", lambda *_args: None)

    def _on_query_data(self, rows: Any) -> None:
        payload_rows = unwrap_signalr_query_data_payload(rows)
        normalized_rows, max_ts = transform_signalr_batch(payload_rows, self.config.source_id, MAX_SIGNALR_BATCH_SIZE)
        self.logger.info(
            "signalr query data received raw_type=%s raw_count=%s normalized=%s",
            type(payload_rows).__name__,
            len(payload_rows) if isinstance(payload_rows, list) else 0,
            len(normalized_rows),
        )
        if (
            isinstance(payload_rows, list)
            and payload_rows
            and not normalized_rows
            and isinstance(payload_rows[0], dict)
        ):
            sample = payload_rows[0]
            keys_preview = list(sample.keys())[:20]
            self.logger.warning(
                "signalr normalize produced 0 rows; sample_keys=%s sample_head=%s",
                keys_preview,
                {key: sample.get(key) for key in keys_preview[:8]},
            )
        if not normalized_rows:
            return
        with self._buffer_lock:
            projected = len(self._buffer) + len(normalized_rows)
            if projected > self.max_buffer_records:
                dropped = projected - self.max_buffer_records
                if dropped >= len(self._buffer):
                    self._buffer = []
                else:
                    del self._buffer[:dropped]
                self._dropped_records += dropped
                self.logger.warning(
                    "signalr buffer overflow dropped=%s max_buffer=%s total_dropped=%s",
                    dropped,
                    self.max_buffer_records,
                    self._dropped_records,
                )
            self._buffer.extend(normalized_rows)
            should_flush = len(self._buffer) >= self.client.config.max_records_per_batch
        if self.ais_query_incremental and max_ts is not None:
            self._last_lower_bound = max_ts + timedelta(minutes=1)
        if should_flush:
            self._flush_buffer()

    def _flush_if_interval_elapsed(self) -> IngestSummary:
        if time.monotonic() - self._last_flush_at < max(self.signalr_loop_sleep_seconds, 1.0):
            return IngestSummary(0, 0, 0, 0)
        return self._flush_buffer()

    def _flush_buffer(self) -> IngestSummary:
        with self._buffer_lock:
            if not self._buffer:
                self._last_flush_at = time.monotonic()
                return IngestSummary(0, 0, 0, 0)
            records = self._buffer
            self._buffer = []
            self._last_flush_at = time.monotonic()
        deduped = dedupe_records(records)
        deduped_count = len(records) - len(deduped)
        if deduped_count > 0:
            self._deduped_records += deduped_count
        summary = self.client.send_records(deduped, request_prefix=self.config.source_id.lower())
        self.logger.info(
            "signalr flush raw=%s deduped=%s dropped_total=%s accepted=%s/%s",
            len(records),
            len(deduped),
            self._dropped_records,
            summary.records_accepted,
            summary.records_attempted,
        )
        return summary

    def _build_hub_url(self) -> str:
        query = urlencode(
            {
                "Device": self.ais_device,
                "ConnectionId": "",
                "ActionTypeValue": self.ais_action_type,
                "Query": self.ais_query,
                "UserId": str(self.ais_user_id),
                "IsQueryLastestDataBeforeStream": self.ais_query_latest_before_stream,
            }
        )
        return f"{self.ais_host}/api/signalR?{query}"

    def _create_signalr_connection(self, hub_url: str) -> Any:
        try:
            from signalrcore.hub_connection_builder import HubConnectionBuilder  # type: ignore
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "signalrcore is required for AIS SignalR connector. Install with pip install signalrcore"
            ) from exc

        return (
            HubConnectionBuilder()
            .with_url(hub_url)
            .with_automatic_reconnect(
                {
                    "type": "raw",
                    "keep_alive_interval": 10,
                    "reconnect_interval": 5,
                    "max_attempts": 20,
                }
            )
            .build()
        )

    def _start_connection(self) -> None:
        self._connection.start()

    def _stop_connection(self) -> None:
        if self._connection is None:
            return
        try:
            self._connection.stop()
        except Exception:
            pass
        self._connection = None

    def _get_connection_id(self) -> Optional[str]:
        candidate = getattr(self._connection, "connection_id", None)
        if candidate:
            return str(candidate)
        transport = getattr(self._connection, "transport", None)
        if transport is not None:
            nested = getattr(transport, "connection_id", None)
            if nested:
                return str(nested)
        return None

    @staticmethod
    def _merge_summaries(left: IngestSummary, right: IngestSummary) -> IngestSummary:
        return IngestSummary(
            batches_attempted=left.batches_attempted + right.batches_attempted,
            batches_accepted=left.batches_accepted + right.batches_accepted,
            records_attempted=left.records_attempted + right.records_attempted,
            records_accepted=left.records_accepted + right.records_accepted,
        )

    @staticmethod
    def _as_bool(raw: str) -> bool:
        return str(raw).strip().lower() not in {"0", "false", "no", "off"}


def main() -> None:
    configure_logging()
    config = GatewayIngestConfig.from_env(default_source_id="AIS-SIGNALR")
    if config.endpoint_path == "/api/v1/ingest/adsb/batch":
        config = GatewayIngestConfig(
            gateway_url=config.gateway_url,
            api_key=config.api_key,
            source_id=config.source_id,
            endpoint_path="/api/v1/ingest/ais/batch",
            max_records_per_batch=config.max_records_per_batch,
            target_payload_bytes=config.target_payload_bytes,
            request_timeout_seconds=config.request_timeout_seconds,
            retry_attempts=config.retry_attempts,
            base_retry_delay_seconds=config.base_retry_delay_seconds,
            send_source_header=config.send_source_header,
            verify_tls=config.verify_tls,
        )
    connector = AisSignalrConnector(config)
    connector.run_forever()


if __name__ == "__main__":
    main()
