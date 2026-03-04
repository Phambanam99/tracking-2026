import unittest
from unittest.mock import Mock, patch

from connectors.aisstream_connector import (
    AisstreamConnector,
    build_subscription_message,
    transform_aisstream_position_message,
)
from connectors.common import GatewayIngestConfig, IngestSummary


class AisstreamConnectorTest(unittest.TestCase):
    def setUp(self) -> None:
        self.config = GatewayIngestConfig(
            gateway_url="http://localhost:8080",
            api_key="test-key",
            source_id="AISSTREAM-IO",
            endpoint_path="/api/v1/ingest/ais/batch",
        )

    def test_build_subscription_message(self):
        message = build_subscription_message("abc123", [[[-90, -180], [90, 180]]])
        self.assertEqual("abc123", message["APIKey"])
        self.assertEqual(["PositionReport", "ShipStaticData"], message["FilterMessageTypes"])
        self.assertEqual([[[-90, -180], [90, 180]]], message["BoundingBoxes"])

    def test_parse_bounding_boxes_backward_compat_single_box(self):
        connector = AisstreamConnector(self.config)
        parsed = connector._parse_bounding_boxes("[[-90,-180],[90,180]]")
        self.assertEqual([[[-90.0, -180.0], [90.0, 180.0]]], parsed)

    def test_transform_position_report_valid(self):
        message = {
            "MessageType": "PositionReport",
            "MetaData": {"MMSI": 574001230, "ShipName": "Hai Phong Trader", "time_utc": "2026-03-04T03:15:30Z"},
            "Message": {
                "PositionReport": {
                    "Latitude": 20.8643,
                    "Longitude": 106.6831,
                    "Sog": 12.34,
                    "Cog": 87.1,
                    "TrueHeading": 90,
                    "NavigationalStatus": 5,
                }
            },
        }

        record = transform_aisstream_position_message(message, "AISSTREAM-IO")
        self.assertIsNotNone(record)
        assert record is not None
        self.assertEqual("574001230", record["mmsi"])
        self.assertEqual("Hai Phong Trader", record["vessel_name"])
        self.assertEqual(20.8643, record["lat"])
        self.assertEqual(106.6831, record["lon"])
        self.assertEqual(12.3, record["speed"])
        self.assertEqual(87.1, record["course"])
        self.assertEqual(90.0, record["heading"])
        self.assertEqual(5, record["nav_status"])
        self.assertEqual("AISSTREAM-IO", record["upstream_source"])

    def test_transform_uses_metadata_fallback_for_coords_and_mmsi(self):
        message = {
            "MessageType": "PositionReport",
            "MetaData": {"MMSI": "574001230", "latitude": 20.2, "longitude": 106.3, "time_utc": "2026-03-04T03:15:30Z"},
            "Message": {"PositionReport": {}},
        }
        record = transform_aisstream_position_message(message, "AISSTREAM-IO")
        self.assertIsNotNone(record)
        assert record is not None
        self.assertEqual("574001230", record["mmsi"])
        self.assertEqual(20.2, record["lat"])
        self.assertEqual(106.3, record["lon"])
        self.assertEqual("AISSTREAM-IO", record["upstream_source"])

    def test_transform_skips_invalid_payload(self):
        invalid_message = {
            "MessageType": "PositionReport",
            "MetaData": {"MMSI": "invalid", "latitude": 20.2, "longitude": 106.3},
            "Message": {"PositionReport": {}},
        }
        self.assertIsNone(transform_aisstream_position_message(invalid_message, "AISSTREAM-IO"))

    def test_transform_uses_now_when_no_timestamp(self):
        message = {
            "MessageType": "PositionReport",
            "MetaData": {"MMSI": "574001230", "latitude": 20.2, "longitude": 106.3},
            "Message": {"PositionReport": {}},
        }
        with patch("connectors.aisstream_connector.time.time", return_value=1709500000):
            record = transform_aisstream_position_message(message, "AISSTREAM-IO")
        self.assertIsNotNone(record)
        assert record is not None
        self.assertEqual(1709500000000, record["event_time"])

    def test_handle_error_message(self):
        connector = AisstreamConnector(self.config)
        summary = connector._handle_message({"error": "bad subscription"})
        self.assertEqual(IngestSummary(0, 0, 0, 0), summary)

    def test_batch_accumulation_and_flush_on_threshold(self):
        with patch.dict("os.environ", {"AISSTREAM_API_KEY": "test-ais-key", "AISSTREAM_BATCH_SIZE": "2"}, clear=False):
            connector = AisstreamConnector(self.config)

        connector.client.send_records = Mock(return_value=IngestSummary(1, 1, 2, 2))
        message = {
            "MessageType": "PositionReport",
            "MetaData": {"MMSI": "574001230", "latitude": 20.2, "longitude": 106.3, "time_utc": "2026-03-04T03:15:30Z"},
            "Message": {"PositionReport": {}},
        }

        summary1 = connector._handle_message(message)
        self.assertEqual(IngestSummary(0, 0, 0, 0), summary1)
        summary2 = connector._handle_message(message)
        self.assertEqual(IngestSummary(1, 1, 2, 2), summary2)
        connector.client.send_records.assert_called_once()

    def test_flush_dedupes_records_before_send(self):
        with patch.dict(
            "os.environ",
            {"AISSTREAM_API_KEY": "test-ais-key", "AISSTREAM_BATCH_SIZE": "100"},
            clear=False,
        ):
            connector = AisstreamConnector(self.config)
        connector.client.send_records = Mock(return_value=IngestSummary(1, 1, 1, 1))
        connector._buffer = [
            {"mmsi": "574001230", "event_time": 1, "lat": 20.2, "lon": 106.3, "source_id": "AISSTREAM-IO"},
            {"mmsi": "574001230", "event_time": 1, "lat": 20.2, "lon": 106.3, "source_id": "AISSTREAM-IO"},
        ]
        summary = connector._flush_buffer()
        self.assertEqual(IngestSummary(1, 1, 1, 1), summary)
        sent_records = connector.client.send_records.call_args.args[0]
        self.assertEqual(1, len(sent_records))

    def test_buffer_overflow_drops_oldest_records(self):
        with patch.dict(
            "os.environ",
            {"AISSTREAM_API_KEY": "test-ais-key", "AISSTREAM_MAX_BUFFER_RECORDS": "1", "AISSTREAM_BATCH_SIZE": "10"},
            clear=False,
        ):
            connector = AisstreamConnector(self.config)
        message1 = {
            "MessageType": "PositionReport",
            "MetaData": {"MMSI": "574001230", "latitude": 20.2, "longitude": 106.3, "time_utc": "2026-03-04T03:15:30Z"},
            "Message": {"PositionReport": {}},
        }
        message2 = {
            "MessageType": "PositionReport",
            "MetaData": {"MMSI": "574001231", "latitude": 20.3, "longitude": 106.4, "time_utc": "2026-03-04T03:16:30Z"},
            "Message": {"PositionReport": {}},
        }
        connector._handle_message(message1)
        connector._handle_message(message2)
        self.assertEqual(1, len(connector._buffer))
        self.assertEqual("574001231", connector._buffer[0]["mmsi"])


if __name__ == "__main__":
    unittest.main()
