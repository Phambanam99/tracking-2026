from __future__ import annotations

import json
import os
import threading
import time
from typing import Any, Dict, List, Optional

try:
    from connectors.common import (
        BaseConnector,
        dedupe_records,
        GatewayIngestConfig,
        IngestSummary,
        configure_logging,
        normalize_heading,
        normalize_mmsi,
        normalize_positive_float,
        normalize_positive_int,
        normalize_text,
        parse_event_time_ms,
        validate_lat_lon,
    )
except ImportError:  # pragma: no cover
    from common import (  # type: ignore
        BaseConnector,
        dedupe_records,
        GatewayIngestConfig,
        IngestSummary,
        configure_logging,
        normalize_heading,
        normalize_mmsi,
        normalize_positive_float,
        normalize_positive_int,
        normalize_text,
        parse_event_time_ms,
        validate_lat_lon,
    )

AISSTREAM_DEFAULT_ENDPOINT = "wss://stream.aisstream.io/v0/stream"


def build_subscription_message(api_key: str, bounding_boxes: List[List[List[float]]]) -> Dict[str, Any]:
    return {
        "APIKey": api_key,
        "BoundingBoxes": bounding_boxes,
        "FilterMessageTypes": ["PositionReport", "ShipStaticData"],
    }


def transform_aisstream_position_message(message: Dict[str, Any], source_id: str) -> Optional[Dict[str, Any]]:
    message_type = normalize_text(message.get("MessageType"))
    if message_type != "PositionReport":
        return None

    payload = message.get("Message") if isinstance(message.get("Message"), dict) else {}
    position_report = payload.get("PositionReport") if isinstance(payload.get("PositionReport"), dict) else {}
    metadata = message.get("MetaData") if isinstance(message.get("MetaData"), dict) else {}

    mmsi = normalize_mmsi(position_report.get("UserID")) or normalize_mmsi(metadata.get("MMSI"))
    lat_value = position_report.get("Latitude", metadata.get("latitude"))
    lon_value = position_report.get("Longitude", metadata.get("longitude"))
    coords = validate_lat_lon(lat_value, lon_value)
    if mmsi is None or coords is None:
        return None
    lat, lon = coords
    if lat == 0.0 and lon == 0.0:
        return None

    event_time = parse_event_time_ms(metadata.get("time_utc")) or int(time.time() * 1000)
    record: Dict[str, Any] = {
        "mmsi": mmsi,
        "lat": lat,
        "lon": lon,
        "event_time": event_time,
        "source_id": source_id,
        "upstream_source": (
            normalize_text(message.get("upstream_source"))
            or normalize_text(message.get("upstreamSource"))
            or normalize_text(metadata.get("source"))
            or normalize_text(metadata.get("provider"))
            or normalize_text(source_id)
        ),
    }

    vessel_name = normalize_text(metadata.get("ShipName"))
    if vessel_name is not None:
        record["vessel_name"] = vessel_name

    speed = normalize_positive_float(position_report.get("Sog"))
    if speed is not None:
        record["speed"] = speed

    course = normalize_heading(position_report.get("Cog"))
    if course is not None:
        record["course"] = course

    heading = normalize_heading(position_report.get("TrueHeading"))
    if heading is not None:
        record["heading"] = heading

    nav_status = normalize_positive_int(position_report.get("NavigationalStatus"), max_value=15)
    if nav_status is not None:
        record["nav_status"] = nav_status

    return record


class AisstreamConnector(BaseConnector):
    """AISStream.io WebSocket connector for real-time AIS vessel data."""

    def __init__(self, config: GatewayIngestConfig) -> None:
        reconnect_delay_seconds = float(os.getenv("AISSTREAM_RECONNECT_DELAY_SECONDS", "5"))
        super().__init__(name="AISSTREAM-IO", config=config, refresh_interval_seconds=reconnect_delay_seconds)
        self.api_key = os.getenv("AISSTREAM_API_KEY", "").strip()
        self.endpoint = os.getenv("AISSTREAM_ENDPOINT", AISSTREAM_DEFAULT_ENDPOINT).strip() or AISSTREAM_DEFAULT_ENDPOINT
        self.batch_size = int(os.getenv("AISSTREAM_BATCH_SIZE", "50"))
        self.flush_interval_seconds = float(os.getenv("AISSTREAM_FLUSH_INTERVAL_SECONDS", "5"))
        self.max_reconnect_attempts = int(os.getenv("AISSTREAM_MAX_RECONNECT_ATTEMPTS", "20"))
        self.socket_timeout_seconds = float(os.getenv("AISSTREAM_SOCKET_TIMEOUT_SECONDS", "1.0"))
        self.max_buffer_records = int(os.getenv("AISSTREAM_MAX_BUFFER_RECORDS", "20000"))

        self.bounding_boxes = self._parse_bounding_boxes(
            os.getenv("AISSTREAM_BOUNDING_BOXES", "[[[-90,-180],[90,180]]]")
        )

        self._buffer: List[Dict[str, Any]] = []
        self._buffer_lock = threading.Lock()
        self._last_flush_at = time.monotonic()
        self._reconnection_attempts = 0
        self._ws: Any = None
        self._dropped_records = 0
        self._deduped_records = 0

    def collect_records(self) -> List[Dict[str, Any]]:
        raise NotImplementedError("AISStream connector is streaming; use run_once()/run_forever().")

    def run_once(self) -> IngestSummary:
        if not self.api_key:
            raise RuntimeError("AISSTREAM_API_KEY is required.")

        websocket = self._import_websocket_client()
        total = IngestSummary(0, 0, 0, 0)
        ws = websocket.create_connection(self.endpoint, timeout=10)
        self._ws = ws
        try:
            ws.settimeout(self.socket_timeout_seconds)
            ws.send(json.dumps(build_subscription_message(self.api_key, self.bounding_boxes)))
            self._reconnection_attempts = 0
            self.logger.info("connected aisstream endpoint=%s", self.endpoint)

            while self._running:
                try:
                    raw_message = ws.recv()
                except Exception as exc:  # websocket timeout or transient recv errors
                    if websocket and isinstance(exc, websocket.WebSocketTimeoutException):
                        total = self._merge_summaries(total, self._flush_if_interval_elapsed())
                        continue
                    raise

                if raw_message is None:
                    break
                if isinstance(raw_message, bytes):
                    text = raw_message.decode("utf-8", errors="ignore")
                else:
                    text = str(raw_message)

                try:
                    parsed = json.loads(text)
                except json.JSONDecodeError:
                    self.logger.warning("invalid aisstream json payload")
                    continue

                batch_summary = self._handle_message(parsed)
                total = self._merge_summaries(total, batch_summary)
                total = self._merge_summaries(total, self._flush_if_interval_elapsed())
        finally:
            flush_summary = self._flush_buffer()
            total = self._merge_summaries(total, flush_summary)
            if self._ws is not None:
                try:
                    self._ws.close()
                except Exception:
                    pass
                self._ws = None
        return total

    def run_forever(self) -> None:
        self._running = True
        self.logger.info("starting connector source=%s endpoint=%s", self.config.source_id, self.endpoint)
        while self._running:
            try:
                self.run_once()
            except KeyboardInterrupt:
                self._running = False
                raise
            except Exception as exc:
                self.logger.warning("aisstream session failed error=%s", exc)

            if not self._running:
                break
            if self._reconnection_attempts >= self.max_reconnect_attempts:
                self.logger.error(
                    "max reconnect attempts reached attempts=%s max=%s",
                    self._reconnection_attempts,
                    self.max_reconnect_attempts,
                )
                break

            self._reconnection_attempts += 1
            delay = min(self.refresh_interval_seconds * (2 ** (self._reconnection_attempts - 1)), 60.0)
            self.logger.info(
                "reconnecting aisstream attempt=%s/%s delay=%.1fs",
                self._reconnection_attempts,
                self.max_reconnect_attempts,
                delay,
            )
            time.sleep(delay)

    def stop(self) -> None:
        self._running = False
        if self._ws is not None:
            try:
                self._ws.close()
            except Exception:
                pass
            self._ws = None

    def _handle_message(self, message: Dict[str, Any]) -> IngestSummary:
        if message.get("error"):
            self.logger.warning("aisstream error message=%s", message.get("error"))
            return IngestSummary(0, 0, 0, 0)

        record = transform_aisstream_position_message(message, self.config.source_id)
        if record is None:
            return IngestSummary(0, 0, 0, 0)

        with self._buffer_lock:
            if len(self._buffer) >= self.max_buffer_records:
                dropped = len(self._buffer) - self.max_buffer_records + 1
                del self._buffer[:dropped]
                self._dropped_records += dropped
                self.logger.warning(
                    "aisstream buffer overflow dropped=%s max_buffer=%s total_dropped=%s",
                    dropped,
                    self.max_buffer_records,
                    self._dropped_records,
                )
            self._buffer.append(record)
            should_flush = len(self._buffer) >= self.batch_size

        if should_flush:
            return self._flush_buffer()
        return IngestSummary(0, 0, 0, 0)

    def _flush_if_interval_elapsed(self) -> IngestSummary:
        if time.monotonic() - self._last_flush_at < self.flush_interval_seconds:
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
            "aisstream flush raw=%s deduped=%s dropped_total=%s accepted=%s/%s",
            len(records),
            len(deduped),
            self._dropped_records,
            summary.records_accepted,
            summary.records_attempted,
        )
        return summary

    @staticmethod
    def _merge_summaries(left: IngestSummary, right: IngestSummary) -> IngestSummary:
        return IngestSummary(
            batches_attempted=left.batches_attempted + right.batches_attempted,
            batches_accepted=left.batches_accepted + right.batches_accepted,
            records_attempted=left.records_attempted + right.records_attempted,
            records_accepted=left.records_accepted + right.records_accepted,
        )

    @staticmethod
    def _parse_bounding_boxes(raw_value: str) -> List[List[List[float]]]:
        try:
            parsed = json.loads(raw_value)
        except json.JSONDecodeError:
            return [[[-90.0, -180.0], [90.0, 180.0]]]
        if not isinstance(parsed, list):
            return [[[-90.0, -180.0], [90.0, 180.0]]]

        # Backward compatibility: [[lat,lon],[lat,lon]] -> wrap into one box.
        if (
            len(parsed) == 2
            and all(isinstance(pair, list) and len(pair) == 2 for pair in parsed)
        ):
            parsed = [parsed]

        normalized: List[List[List[float]]] = []
        for box in parsed:
            if not isinstance(box, list) or len(box) != 2:
                continue
            left, right = box[0], box[1]
            if not (isinstance(left, list) and len(left) == 2 and isinstance(right, list) and len(right) == 2):
                continue
            try:
                lat1, lon1 = float(left[0]), float(left[1])
                lat2, lon2 = float(right[0]), float(right[1])
            except (TypeError, ValueError):
                continue
            normalized.append([[lat1, lon1], [lat2, lon2]])
        if not normalized:
            return [[[-90.0, -180.0], [90.0, 180.0]]]
        return normalized

    @staticmethod
    def _import_websocket_client() -> Any:
        try:
            import websocket  # type: ignore

            return websocket
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError("websocket-client is required. Install with pip install websocket-client") from exc


def main() -> None:
    configure_logging()
    config = GatewayIngestConfig.from_env(default_source_id="AISSTREAM-IO")
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
    connector = AisstreamConnector(config)
    connector.run_forever()


if __name__ == "__main__":
    main()
