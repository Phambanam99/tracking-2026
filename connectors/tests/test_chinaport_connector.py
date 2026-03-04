import unittest
from unittest.mock import Mock, patch

from connectors.chinaport_connector import (
    ChinaportAisConnector,
    iter_sse_messages,
    parse_event_time_ms,
    transform_chinaport_vessels,
)
from connectors.common import GatewayIngestConfig


class ChinaportConnectorTest(unittest.TestCase):
    def test_should_transform_valid_vessels_to_ship_ingest_records(self):
        vessels = [
            {
                "mmsi": "574001230",
                "shipName": "Hai Phong Trader",
                "lat": 20.8643,
                "lon": 106.6831,
                "speed": 12.34,
                "course": 87.1,
                "heading": 90,
                "updatetime": "2026-03-03T10:15:30Z",
            },
            {
                "mmsi": "invalid",
                "lat": 20.0,
                "lon": 106.0,
            },
            {
                "mmsi": "574001231",
                "lat": 0,
                "lon": 0,
            },
        ]

        records = transform_chinaport_vessels(vessels, source_id="CHINAPORT-AIS", fallback_event_time_ms=1709450000000)

        self.assertEqual(1, len(records))
        self.assertEqual("574001230", records[0]["mmsi"])
        self.assertEqual("Hai Phong Trader", records[0]["vessel_name"])
        self.assertEqual("CHINAPORT-AIS", records[0]["source_id"])
        self.assertEqual("CHINAPORT-AIS", records[0]["upstream_source"])
        self.assertEqual(20.8643, records[0]["lat"])
        self.assertEqual(106.6831, records[0]["lon"])
        self.assertEqual(12.3, records[0]["speed"])
        self.assertEqual(87.1, records[0]["course"])
        self.assertEqual(90.0, records[0]["heading"])
        self.assertIn("event_time", records[0])

    def test_should_transform_priority_vessels_with_minimal_fields(self):
        vessels = [
            {
                "mmsi": "574001230",
                "lat": 20.8643,
                "lon": 106.6831,
                "updatetime": "2026-03-03T10:15:30Z",
            }
        ]

        records = transform_chinaport_vessels(vessels, source_id="CHINAPORT-AIS")

        self.assertEqual(1, len(records))
        self.assertEqual("574001230", records[0]["mmsi"])
        self.assertEqual(20.8643, records[0]["lat"])
        self.assertEqual(106.6831, records[0]["lon"])
        self.assertEqual(parse_event_time_ms("2026-03-03T10:15:30Z"), records[0]["event_time"])
        self.assertEqual("CHINAPORT-AIS", records[0]["upstream_source"])
        self.assertNotIn("speed", records[0])
        self.assertNotIn("heading", records[0])

    def test_should_parse_sse_messages_from_iter_lines(self):
        lines = [
            "event: vessel_update",
            'data: {"vessels":[{"mmsi":"574001230","lat":20.8,"lon":106.6}]}',
            "",
            ": keepalive",
            "event: heartbeat",
            'data: {"type":"heartbeat"}',
            "",
        ]

        messages = list(iter_sse_messages(lines))

        self.assertEqual(2, len(messages))
        self.assertEqual("vessel_update", messages[0]["event"])
        self.assertIn('"mmsi":"574001230"', messages[0]["data"])
        self.assertEqual("heartbeat", messages[1]["event"])

    def test_should_collect_and_flush_records_from_sse_stream(self):
        config = GatewayIngestConfig(
            gateway_url="http://localhost:8080",
            api_key="test-key",
            source_id="CHINAPORT-AIS",
            endpoint_path="/api/v1/ingest/ais/batch",
        )
        connector = ChinaportAisConnector(config)

        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=None)
        response.raise_for_status.return_value = None
        response.iter_lines.return_value = iter(
            [
                "event: vessel_update",
                'data: {"vessels":[{"mmsi":"574001230","shipName":"Hai Phong Trader","lat":20.8643,"lon":106.6831,"speed":12.0,"course":87.1,"heading":90,"updatetime":"2026-03-03T10:15:30Z"}]}',
                "",
            ]
        )

        with patch.object(connector.session, "get", return_value=response) as get_mock:
            with patch.object(connector.client, "send_records") as send_records_mock:
                connector.run_once()

        get_mock.assert_called_once()
        send_records_mock.assert_called_once()
        sent_records = send_records_mock.call_args.args[0]
        self.assertEqual(1, len(sent_records))
        self.assertEqual("574001230", sent_records[0]["mmsi"])
        self.assertEqual("/api/v1/ingest/ais/batch", connector.client.ingest_url.replace("http://localhost:8080", ""))

    def test_should_accept_priority_update_event(self):
        config = GatewayIngestConfig(
            gateway_url="http://localhost:8080",
            api_key="test-key",
            source_id="CHINAPORT-AIS",
            endpoint_path="/api/v1/ingest/ais/batch",
        )
        connector = ChinaportAisConnector(config)

        with patch.object(connector.client, "send_records", return_value=Mock(records_accepted=1, records_attempted=1, batches_accepted=1, batches_attempted=1)) as send_records_mock:
            summary = connector._handle_sse_message(
                {
                    "event": "priority_update",
                    "data": '{"vessels":[{"mmsi":"574001230","lat":20.8643,"lon":106.6831,"updatetime":"2026-03-03T10:15:30Z"}]}',
                },
                accepted_event_types={"priority_update"},
                stream_name="priority",
            )

        self.assertEqual(1, summary.records_accepted)
        send_records_mock.assert_called_once()


if __name__ == "__main__":
    unittest.main()
