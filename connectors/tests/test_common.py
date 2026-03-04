import math
import os
import unittest
from datetime import datetime, timezone

from connectors.common import (
    GatewayIngestClient,
    GatewayIngestConfig,
    completeness_score_ais,
    convert_gmt7_to_utc,
    dedupe_records,
    estimate_payload_bytes,
    normalize_heading,
    normalize_mmsi,
    normalize_positive_float,
    normalize_positive_int,
    normalize_text,
    parse_event_time_ms,
    serialize_payload,
    validate_lat_lon,
)


class GatewayIngestClientTest(unittest.TestCase):
    def build_client(self, max_records_per_batch=1000, target_payload_bytes=220 * 1024):
        config = GatewayIngestConfig(
            gateway_url="http://localhost:8080",
            api_key="test-key",
            source_id="TEST-SOURCE",
            max_records_per_batch=max_records_per_batch,
            target_payload_bytes=target_payload_bytes,
        )
        return GatewayIngestClient(config)

    def test_should_split_by_record_count(self):
        client = self.build_client(max_records_per_batch=2, target_payload_bytes=10_000)
        records = [
            {"icao": "ABC001", "lat": 1.0, "lon": 1.0, "event_time": 1},
            {"icao": "ABC002", "lat": 1.0, "lon": 1.0, "event_time": 1},
            {"icao": "ABC003", "lat": 1.0, "lon": 1.0, "event_time": 1},
        ]

        chunks = client.chunk_records(records)

        self.assertEqual(2, len(chunks))
        self.assertEqual(2, len(chunks[0]))
        self.assertEqual(1, len(chunks[1]))

    def test_should_split_by_payload_bytes(self):
        client = self.build_client(max_records_per_batch=1000, target_payload_bytes=220)
        records = [
            {"icao": "ABC001", "lat": 1.0, "lon": 1.0, "event_time": 1, "pad": "x" * 80},
            {"icao": "ABC002", "lat": 1.0, "lon": 1.0, "event_time": 1, "pad": "x" * 80},
            {"icao": "ABC003", "lat": 1.0, "lon": 1.0, "event_time": 1, "pad": "x" * 80},
        ]

        chunks = client.chunk_records(records)

        self.assertGreater(len(chunks), 1)
        for chunk in chunks:
            self.assertLessEqual(estimate_payload_bytes(chunk), 220)

    def test_should_reject_non_finite_numbers_from_normalizers(self):
        self.assertIsNone(normalize_positive_float(float("inf")))
        self.assertIsNone(normalize_positive_float(float("nan")))
        self.assertIsNone(normalize_heading(float("inf")))
        self.assertIsNone(validate_lat_lon(float("nan"), 105.0))
        self.assertIsNone(normalize_positive_int(9_999_999_999))

    def test_should_fail_fast_for_non_finite_json_payload(self):
        with self.assertRaises(ValueError):
            serialize_payload({"records": [{"icao": "ABC123", "lat": 1.0, "lon": 2.0, "event_time": math.inf}]})

    def test_should_enable_source_header_by_default_from_env(self):
        previous_api_key = os.environ.get("API_KEY")
        previous_send_source_header = os.environ.get("SEND_SOURCE_HEADER")
        try:
            os.environ["API_KEY"] = "test-key"
            os.environ.pop("SEND_SOURCE_HEADER", None)

            config = GatewayIngestConfig.from_env(default_source_id="TEST-SOURCE")

            self.assertTrue(config.send_source_header)
        finally:
            if previous_api_key is None:
                os.environ.pop("API_KEY", None)
            else:
                os.environ["API_KEY"] = previous_api_key

            if previous_send_source_header is None:
                os.environ.pop("SEND_SOURCE_HEADER", None)
            else:
                os.environ["SEND_SOURCE_HEADER"] = previous_send_source_header

    def test_should_allow_ingest_endpoint_override_from_env(self):
        previous_api_key = os.environ.get("API_KEY")
        previous_endpoint_path = os.environ.get("INGEST_ENDPOINT_PATH")
        try:
            os.environ["API_KEY"] = "test-key"
            os.environ["INGEST_ENDPOINT_PATH"] = "/api/v1/ingest/ais/batch"

            config = GatewayIngestConfig.from_env(default_source_id="TEST-SOURCE")

            self.assertEqual("/api/v1/ingest/ais/batch", config.endpoint_path)
        finally:
            if previous_api_key is None:
                os.environ.pop("API_KEY", None)
            else:
                os.environ["API_KEY"] = previous_api_key

            if previous_endpoint_path is None:
                os.environ.pop("INGEST_ENDPOINT_PATH", None)
            else:
                os.environ["INGEST_ENDPOINT_PATH"] = previous_endpoint_path

    def test_should_normalize_mmsi_and_text(self):
        self.assertEqual("574001230", normalize_mmsi("574001230"))
        self.assertIsNone(normalize_mmsi("invalid"))
        self.assertEqual("Hai Phong Trader", normalize_text("  Hai Phong Trader "))
        self.assertIsNone(normalize_text("   "))

    def test_should_parse_event_time_ms_from_epoch_or_iso(self):
        self.assertEqual(1709450000000, parse_event_time_ms(1709450000))
        self.assertEqual(1709450000000, parse_event_time_ms(1709450000000))
        self.assertEqual(
            int(datetime(2026, 3, 3, 10, 15, 30, tzinfo=timezone.utc).timestamp() * 1000),
            parse_event_time_ms("2026-03-03T10:15:30Z"),
        )
        self.assertIsNone(parse_event_time_ms("not-a-time"))

    def test_should_convert_fake_gmt7_z_to_utc(self):
        converted = convert_gmt7_to_utc("2026-03-03T10:15:30Z")
        self.assertIsNotNone(converted)
        assert converted is not None
        self.assertEqual(datetime(2026, 3, 3, 3, 15, 30, tzinfo=timezone.utc), converted)

    def test_should_calculate_ais_completeness_score(self):
        record = {
            "mmsi": "574001230",
            "lat": 20.8,
            "lon": 106.6,
            "event_time": 1709450000000,
            "vessel_name": "Hai Phong Trader",
            "speed": 12.0,
            "course": 87.0,
            "heading": 90.0,
            "nav_status": 5,
        }
        self.assertEqual(5, completeness_score_ais(record))

    def test_should_dedupe_records_by_default_ais_key(self):
        records = [
            {"mmsi": "574001230", "event_time": 1, "lat": 20.1, "lon": 106.1, "source_id": "AIS"},
            {"mmsi": "574001230", "event_time": 1, "lat": 20.1, "lon": 106.1, "source_id": "AIS"},
            {"mmsi": "574001230", "event_time": 2, "lat": 20.2, "lon": 106.2, "source_id": "AIS"},
        ]
        deduped = dedupe_records(records)
        self.assertEqual(2, len(deduped))


if __name__ == "__main__":
    unittest.main()
