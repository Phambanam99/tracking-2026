from __future__ import annotations

import json
import os
import threading
import time
from typing import Any, Dict, Iterable, Iterator, List, Optional, Set

import requests

try:
    from connectors.common import (
        BaseConnector,
        GatewayIngestConfig,
        IngestSummary,
        configure_logging,
        normalize_mmsi,
        normalize_text,
        normalize_heading,
        normalize_positive_float,
        parse_event_time_ms,
        validate_lat_lon,
    )
except ImportError:  # pragma: no cover
    from common import (  # type: ignore
        BaseConnector,
        GatewayIngestConfig,
        IngestSummary,
        configure_logging,
        normalize_mmsi,
        normalize_text,
        normalize_heading,
        normalize_positive_float,
        parse_event_time_ms,
        validate_lat_lon,
    )


class ChinaportAisConnector(BaseConnector):
    def __init__(self, config: GatewayIngestConfig) -> None:
        reconnect_delay_seconds = float(os.getenv("CHINAPORT_RECONNECT_DELAY_SECONDS", "5"))
        super().__init__(name="CHINAPORT-AIS", config=config, refresh_interval_seconds=reconnect_delay_seconds)
        self.session = requests.Session()
        self.sse_url = os.getenv("CHINAPORT_SSE_URL", "http://10.75.10.3:8080/sse/vessels").strip()
        self.priority_sse_url = os.getenv("CHINAPORT_PRIORITY_SSE_URL", "").strip()
        self.connect_timeout_seconds = int(os.getenv("CHINAPORT_CONNECT_TIMEOUT_SECONDS", "10"))
        self.read_timeout_seconds = int(os.getenv("CHINAPORT_READ_TIMEOUT_SECONDS", "90"))
        self.accepted_event_types = {"message", "vessel_update", "vessels"}
        self.priority_event_types = {"priority_update"}
        self._worker_threads: List[threading.Thread] = []

    def collect_records(self) -> List[Dict[str, Any]]:
        raise NotImplementedError("ChinaportAisConnector uses a streaming SSE loop instead of snapshot polling.")

    def run_once(self) -> IngestSummary:
        total_attempted = 0
        total_accepted = 0
        accepted_batches = 0
        attempted_batches = 0

        headers = {"Accept": "text/event-stream", "Cache-Control": "no-cache"}
        with self.session.get(
            self.sse_url,
            headers=headers,
            stream=True,
            timeout=(self.connect_timeout_seconds, self.read_timeout_seconds),
            verify=self.config.verify_tls,
        ) as response:
            response.raise_for_status()
            self.logger.info("connected to Chinaport SSE url=%s", self.sse_url)

            for message in iter_sse_messages(response.iter_lines(decode_unicode=True)):
                summary = self._handle_sse_message(
                    message,
                    accepted_event_types=self.accepted_event_types,
                    stream_name="main",
                )
                total_attempted += summary.records_attempted
                total_accepted += summary.records_accepted
                accepted_batches += summary.batches_accepted
                attempted_batches += summary.batches_attempted

        return IngestSummary(
            batches_attempted=attempted_batches,
            batches_accepted=accepted_batches,
            records_attempted=total_attempted,
            records_accepted=total_accepted,
        )

    def run_forever(self) -> None:
        self._running = True
        self.logger.info("starting Chinaport SSE connector source=%s url=%s", self.config.source_id, self.sse_url)
        self._worker_threads = [
            threading.Thread(
                target=self._run_stream_loop,
                args=("main", self.sse_url, self.accepted_event_types),
                daemon=True,
            )
        ]
        if self.priority_sse_url:
            self._worker_threads.append(
                threading.Thread(
                    target=self._run_stream_loop,
                    args=("priority", self.priority_sse_url, self.priority_event_types),
                    daemon=True,
                )
            )
        for worker in self._worker_threads:
            worker.start()
        try:
            while self._running:
                time.sleep(1.0)
        except KeyboardInterrupt:
            self._running = False
            raise
        finally:
            for worker in self._worker_threads:
                worker.join(timeout=1.0)

    def _run_stream_loop(self, stream_name: str, stream_url: str, accepted_event_types: Set[str]) -> None:
        while self._running:
            try:
                self._consume_stream(stream_name, stream_url, accepted_event_types)
            except Exception as exc:  # pragma: no cover
                self.logger.exception("Chinaport %s SSE loop failed: %s", stream_name, exc)
            if self._running:
                time.sleep(self.refresh_interval_seconds)

    def _consume_stream(self, stream_name: str, stream_url: str, accepted_event_types: Set[str]) -> IngestSummary:
        total_attempted = 0
        total_accepted = 0
        accepted_batches = 0
        attempted_batches = 0
        headers = {"Accept": "text/event-stream", "Cache-Control": "no-cache"}
        with requests.Session() as session:
            with session.get(
                stream_url,
                headers=headers,
                stream=True,
                timeout=(self.connect_timeout_seconds, self.read_timeout_seconds),
                verify=self.config.verify_tls,
            ) as response:
                response.raise_for_status()
                self.logger.info("connected to Chinaport %s SSE url=%s", stream_name, stream_url)
                for message in iter_sse_messages(response.iter_lines(decode_unicode=True)):
                    if not self._running:
                        break
                    summary = self._handle_sse_message(
                        message,
                        accepted_event_types=accepted_event_types,
                        stream_name=stream_name,
                    )
                    total_attempted += summary.records_attempted
                    total_accepted += summary.records_accepted
                    accepted_batches += summary.batches_accepted
                    attempted_batches += summary.batches_attempted
        return IngestSummary(
            batches_attempted=attempted_batches,
            batches_accepted=accepted_batches,
            records_attempted=total_attempted,
            records_accepted=total_accepted,
        )

    def _handle_sse_message(
        self,
        message: Dict[str, str],
        accepted_event_types: Optional[Set[str]] = None,
        stream_name: str = "main",
    ) -> IngestSummary:
        event_name = (message.get("event") or "message").strip().lower()
        payload_text = (message.get("data") or "").strip()
        if not payload_text:
            return IngestSummary(0, 0, 0, 0)

        if event_name == "heartbeat":
            self.logger.debug("received Chinaport heartbeat")
            return IngestSummary(0, 0, 0, 0)

        allowed_event_types = accepted_event_types or self.accepted_event_types
        if event_name not in allowed_event_types:
            self.logger.debug("ignored Chinaport %s event type=%s", stream_name, event_name)
            return IngestSummary(0, 0, 0, 0)

        try:
            payload = json.loads(payload_text)
        except json.JSONDecodeError:
            self.logger.warning("ignored invalid Chinaport SSE payload event=%s", event_name)
            return IngestSummary(0, 0, 0, 0)

        if isinstance(payload, dict) and payload.get("type") == "heartbeat":
            return IngestSummary(0, 0, 0, 0)

        vessels = payload.get("vessels") if isinstance(payload, dict) else payload
        if not isinstance(vessels, list):
            return IngestSummary(0, 0, 0, 0)

        fallback_event_time_ms = parse_event_time_ms(payload.get("timestamp")) if isinstance(payload, dict) else None
        records = transform_chinaport_vessels(
            vessels,
            source_id=self.config.source_id,
            fallback_event_time_ms=fallback_event_time_ms,
        )
        if not records:
            return IngestSummary(0, 0, 0, 0)
        summary = self.client.send_records(records, request_prefix=self.config.source_id.lower())
        self.logger.info(
            "processed Chinaport %s SSE batch event=%s records=%s accepted=%s/%s batches=%s/%s",
            stream_name,
            event_name,
            len(records),
            summary.records_accepted,
            summary.records_attempted,
            summary.batches_accepted,
            summary.batches_attempted,
        )
        return summary


def iter_sse_messages(lines: Iterable[str]) -> Iterator[Dict[str, str]]:
    fields: Dict[str, List[str]] = {}
    for raw_line in lines:
        line = raw_line.decode("utf-8") if isinstance(raw_line, bytes) else str(raw_line)
        line = line.rstrip("\r")

        if not line:
            if fields:
                yield {
                    "event": "\n".join(fields.get("event", [])) or "message",
                    "data": "\n".join(fields.get("data", [])),
                }
                fields = {}
            continue

        if line.startswith(":"):
            continue

        field_name, separator, field_value = line.partition(":")
        if not separator:
            continue
        normalized_value = field_value[1:] if field_value.startswith(" ") else field_value
        fields.setdefault(field_name, []).append(normalized_value)

    if fields:
        yield {
            "event": "\n".join(fields.get("event", [])) or "message",
            "data": "\n".join(fields.get("data", [])),
        }


def transform_chinaport_vessels(
    vessels: List[Dict[str, Any]],
    source_id: str,
    fallback_event_time_ms: Optional[int] = None,
) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    for vessel in vessels:
        mmsi = normalize_mmsi(vessel.get("mmsi"))
        lat_value = vessel.get("lat")
        if lat_value is None:
            lat_value = vessel.get("latitude")
        lon_value = vessel.get("lon")
        if lon_value is None:
            lon_value = vessel.get("longitude")
        coords = validate_lat_lon(
            lat_value,
            lon_value,
        )
        if mmsi is None or coords is None:
            continue
        lat, lon = coords
        if lat == 0.0 and lon == 0.0:
            continue

        event_time = (
            parse_event_time_ms(vessel.get("updatetime"))
            or parse_event_time_ms(vessel.get("timestamp"))
            or fallback_event_time_ms
            or int(time.time() * 1000)
        )

        record: Dict[str, Any] = {
            "mmsi": mmsi,
            "lat": lat,
            "lon": lon,
            "event_time": event_time,
            "source_id": source_id,
            "upstream_source": (
                normalize_text(vessel.get("upstream_source"))
                or normalize_text(vessel.get("upstreamSource"))
                or normalize_text(vessel.get("source"))
                or normalize_text(vessel.get("provider"))
                or normalize_text(source_id)
            ),
        }

        vessel_name = normalize_text(vessel.get("shipName")) or normalize_text(vessel.get("name"))
        if vessel_name is not None:
            record["vessel_name"] = vessel_name

        speed = normalize_positive_float(vessel.get("speed"))
        if speed is not None:
            record["speed"] = speed

        course = normalize_heading(vessel.get("course"))
        if course is not None:
            record["course"] = course

        heading = normalize_heading(vessel.get("heading"))
        if heading is not None:
            record["heading"] = heading

        record["score"] = 1.0
        records.append(record)

    return records

def main() -> None:
    configure_logging()
    config = GatewayIngestConfig.from_env(default_source_id="CHINAPORT-AIS")
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
    connector = ChinaportAisConnector(config)
    connector.run_forever()


if __name__ == "__main__":
    main()
