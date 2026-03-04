import unittest
from datetime import datetime, timezone
from unittest.mock import Mock, patch

from connectors.ais_signalr_connector import (
    AisSignalrConnector,
    build_dynamic_query,
    transform_signalr_batch,
    transform_signalr_record,
    unwrap_signalr_query_data_payload,
)
from connectors.common import GatewayIngestConfig, IngestSummary


class AisSignalrConnectorTest(unittest.TestCase):
    def setUp(self) -> None:
        self.config = GatewayIngestConfig(
            gateway_url="http://localhost:8080",
            api_key="test-key",
            source_id="AIS-SIGNALR",
            endpoint_path="/api/v1/ingest/ais/batch",
        )

    def test_build_dynamic_query_basic(self):
        now = datetime(2026, 3, 4, 3, 30, 0, tzinfo=timezone.utc)
        query, lower = build_dynamic_query(
            static_query="(updatetime >= DateTime(2025,1,1,0,0,0))[***]",
            query_minutes=10,
            last_lower_bound=None,
            incremental=False,
            now_utc=now,
        )
        self.assertEqual(datetime(2026, 3, 4, 3, 20, 0, tzinfo=timezone.utc), lower)
        self.assertIn("DateTime(2026, 3, 4, 10, 20, 0)", query)
        self.assertTrue(query.endswith("[***]"))

    def test_build_dynamic_query_incremental(self):
        last = datetime(2026, 3, 4, 2, 0, 10, tzinfo=timezone.utc)
        query, lower = build_dynamic_query(
            static_query="(updatetime >= DateTime(2025,1,1,0,0,0))[***]",
            query_minutes=10,
            last_lower_bound=last,
            incremental=True,
            now_utc=datetime(2026, 3, 4, 3, 30, 0, tzinfo=timezone.utc),
        )
        self.assertEqual(datetime(2026, 3, 4, 2, 0, 0, tzinfo=timezone.utc), lower)
        self.assertIn("DateTime(2026, 3, 4, 9, 0, 0)", query)

    def test_transform_signalr_record_valid(self):
        record = transform_signalr_record(
            {
                "mmsi": "574001230",
                "lat": 20.8643,
                "lon": 106.6831,
                "updatetime": "2026-03-04T10:15:30Z",
                "shipName": "Hai Phong Trader",
                "speed": 12.34,
                "course": 87.1,
                "heading": 90,
            },
            "AIS-SIGNALR",
        )
        self.assertIsNotNone(record)
        assert record is not None
        self.assertEqual("574001230", record["mmsi"])
        self.assertEqual("Hai Phong Trader", record["vessel_name"])
        self.assertEqual(12.3, record["speed"])
        self.assertEqual(87.1, record["course"])
        self.assertEqual(90.0, record["heading"])
        # Fake Z source timestamp is GMT+7, so UTC should be 03:15:30
        expected_ms = int(datetime(2026, 3, 4, 3, 15, 30, tzinfo=timezone.utc).timestamp() * 1000)
        self.assertEqual(expected_ms, record["event_time"])

    def test_transform_signalr_batch_filters_invalid(self):
        rows, max_ts = transform_signalr_batch(
            [
                {
                    "mmsi": "574001230",
                    "lat": 20.8,
                    "lon": 106.6,
                    "updatetime": "2026-03-04T10:15:30Z",
                },
                {"mmsi": "invalid", "lat": 20.8, "lon": 106.6, "updatetime": "2026-03-04T10:15:30Z"},
                {"mmsi": "574001231", "lat": 0, "lon": 0, "updatetime": "2026-03-04T10:15:30Z"},
            ],
            "AIS-SIGNALR",
        )
        self.assertEqual(1, len(rows))
        self.assertIsNotNone(max_ts)

    def test_transform_signalr_record_with_alias_fields(self):
        record = transform_signalr_record(
            {
                "UserID": "574009999",
                "Latitude": 21.02,
                "Longitude": 106.91,
                "UpdateTime": "2026-03-04T10:20:00Z",
                "ShipName": "Alias Vessel",
                "Sog": 10.95,
                "Cog": 45.2,
                "TrueHeading": 46,
            },
            "AIS-SIGNALR",
        )
        self.assertIsNotNone(record)
        assert record is not None
        self.assertEqual("574009999", record["mmsi"])
        self.assertEqual("Alias Vessel", record["vessel_name"])
        self.assertEqual(10.9, record["speed"])
        self.assertEqual(45.2, record["course"])
        self.assertEqual(46.0, record["heading"])

    def test_transform_signalr_record_adds_upstream_source(self):
        record = transform_signalr_record(
            {
                "mmsi": "574001230",
                "lat": 20.8643,
                "lon": 106.6831,
                "updatetime": "2026-03-04T10:15:30Z",
                "source": "hifleet",
            },
            "AIS-SIGNALR",
        )
        self.assertIsNotNone(record)
        assert record is not None
        self.assertEqual("AIS-SIGNALR", record["source_id"])
        self.assertEqual("hifleet", record["upstream_source"])

    def test_transform_signalr_record_falls_back_upstream_source_to_source_id(self):
        record = transform_signalr_record(
            {
                "mmsi": "574001230",
                "lat": 20.8643,
                "lon": 106.6831,
                "updatetime": "2026-03-04T10:15:30Z",
            },
            "AIS-SIGNALR",
        )
        self.assertIsNotNone(record)
        assert record is not None
        self.assertEqual("AIS-SIGNALR", record["upstream_source"])

    def test_max_batch_size_truncation(self):
        raw_rows = [
            {"mmsi": "574001230", "lat": 20.8, "lon": 106.6, "updatetime": "2026-03-04T10:15:30Z"}
            for _ in range(10_200)
        ]
        rows, _ = transform_signalr_batch(raw_rows, "AIS-SIGNALR", max_batch_size=10_000)
        self.assertEqual(10_000, len(rows))

    def test_unwrap_signalr_query_data_payload(self):
        nested = [[{"mmsi": "574001230"}]]
        self.assertEqual([{"mmsi": "574001230"}], unwrap_signalr_query_data_payload(nested))
        wrapped = {"arguments": [[{"mmsi": "574001230"}]]}
        self.assertEqual([{"mmsi": "574001230"}], unwrap_signalr_query_data_payload(wrapped))

    def test_incremental_advancement_after_query_data(self):
        with patch.dict(
            "os.environ",
            {
                "AIS_HOST": "https://ais.example.com",
                "AIS_QUERY": "(updatetime >= DateTime(2025,1,1,0,0,0))[***]",
                "AIS_QUERY_INCREMENTAL": "true",
            },
            clear=False,
        ):
            connector = AisSignalrConnector(self.config)

        connector.client.send_records = Mock(return_value=IngestSummary(1, 1, 1, 1))
        connector._on_query_data(
            [
                {"mmsi": "574001230", "lat": 20.8, "lon": 106.6, "updatetime": "2026-03-04T10:15:30Z"},
                {"mmsi": "574001230", "lat": 20.9, "lon": 106.7, "updatetime": "2026-03-04T10:16:30Z"},
            ]
        )
        self.assertIsNotNone(connector._last_lower_bound)
        assert connector._last_lower_bound is not None
        self.assertEqual(datetime(2026, 3, 4, 3, 17, 30, tzinfo=timezone.utc), connector._last_lower_bound)

    def test_trigger_query_posts_payload(self):
        with patch.dict(
            "os.environ",
            {
                "AIS_HOST": "https://ais.example.com",
                "AIS_QUERY": "(updatetime >= DateTime(2025,1,1,0,0,0))[***]",
                "AIS_USER_ID": "5",
            },
            clear=False,
        ):
            connector = AisSignalrConnector(self.config)

        mock_conn = Mock()
        mock_conn.connection_id = "cid-1"
        connector._connection = mock_conn

        response = Mock()
        response.content = b'{"ok":true}'
        response.json.return_value = {"ok": True}
        response.raise_for_status.return_value = None
        connector.session.post = Mock(return_value=response)

        result = connector.trigger_query(force_static=True)
        self.assertEqual({"ok": True}, result)
        connector.session.post.assert_called_once()

    def test_trigger_query_ingests_inline_payload(self):
        with patch.dict(
            "os.environ",
            {
                "AIS_HOST": "https://ais.example.com",
                "AIS_QUERY": "(updatetime >= DateTime(2025,1,1,0,0,0))[***]",
                "AIS_USER_ID": "5",
            },
            clear=False,
        ):
            connector = AisSignalrConnector(self.config)

        mock_conn = Mock()
        mock_conn.connection_id = "cid-1"
        connector._connection = mock_conn
        connector.client.send_records = Mock(return_value=IngestSummary(1, 1, 1, 1))

        response = Mock()
        response.content = b'[{"mmsi":"574001230","lat":20.8,"lon":106.6,"updatetime":"2026-03-04T10:15:30Z"}]'
        response.json.return_value = [
            {"mmsi": "574001230", "lat": 20.8, "lon": 106.6, "updatetime": "2026-03-04T10:15:30Z"}
        ]
        response.raise_for_status.return_value = None
        connector.session.post = Mock(return_value=response)

        connector.trigger_query(force_static=True)
        connector._flush_buffer()

        connector.client.send_records.assert_called()

    def test_flush_dedupes_records_before_send(self):
        with patch.dict(
            "os.environ",
            {
                "AIS_HOST": "https://ais.example.com",
                "AIS_QUERY": "(updatetime >= DateTime(2025,1,1,0,0,0))[***]",
            },
            clear=False,
        ):
            connector = AisSignalrConnector(self.config)
        connector.client.send_records = Mock(return_value=IngestSummary(1, 1, 1, 1))
        connector._buffer = [
            {"mmsi": "574001230", "event_time": 1, "lat": 20.2, "lon": 106.3, "source_id": "AIS-SIGNALR"},
            {"mmsi": "574001230", "event_time": 1, "lat": 20.2, "lon": 106.3, "source_id": "AIS-SIGNALR"},
        ]
        summary = connector._flush_buffer()
        self.assertEqual(IngestSummary(1, 1, 1, 1), summary)
        sent_records = connector.client.send_records.call_args.args[0]
        self.assertEqual(1, len(sent_records))

    def test_buffer_overflow_drops_oldest_records(self):
        with patch.dict(
            "os.environ",
            {
                "AIS_HOST": "https://ais.example.com",
                "AIS_QUERY": "(updatetime >= DateTime(2025,1,1,0,0,0))[***]",
                "AIS_SIGNALR_MAX_BUFFER_RECORDS": "1",
            },
            clear=False,
        ):
            connector = AisSignalrConnector(self.config)
        connector._on_query_data(
            [{"mmsi": "574001230", "lat": 20.8, "lon": 106.6, "updatetime": "2026-03-04T10:15:30Z"}]
        )
        connector._on_query_data(
            [{"mmsi": "574001231", "lat": 20.9, "lon": 106.7, "updatetime": "2026-03-04T10:16:30Z"}]
        )
        self.assertEqual(1, len(connector._buffer))
        self.assertEqual("574001231", connector._buffer[0]["mmsi"])


if __name__ == "__main__":
    unittest.main()
