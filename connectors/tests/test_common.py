import math
import os
import unittest

from connectors.common import (
    GatewayIngestClient,
    GatewayIngestConfig,
    estimate_payload_bytes,
    normalize_heading,
    normalize_positive_float,
    normalize_positive_int,
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


if __name__ == "__main__":
    unittest.main()
