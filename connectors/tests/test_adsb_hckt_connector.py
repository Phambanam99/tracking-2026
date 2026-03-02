import unittest
from unittest.mock import Mock, patch

from connectors.adsb_hckt_connector import AdsbHcktConnector, transform_hckt_payload
from connectors.common import GatewayIngestConfig


class AdsbHcktConnectorTest(unittest.TestCase):
    def test_should_transform_tar1090_payload_to_ingest_records(self):
        payload = {
            "now": 1709280000.5,
            "aircraft": [
                {
                    "hex": "888174",
                    "lat": 21.0285,
                    "lon": 105.8542,
                    "alt_baro": 12000,
                    "gs": 250.0,
                    "track": 45.2,
                    "seen_pos": 0.4,
                    "flight": "VJC903  ",
                    "t": "A321",
                },
                {
                    "hex": "badhex",
                    "lat": 21.0,
                    "lon": 105.0,
                },
            ],
        }

        records = transform_hckt_payload(payload, source_id="ADSB-HCKT")

        self.assertEqual(1, len(records))
        self.assertEqual("888174", records[0]["icao"])
        self.assertEqual("ADSB-HCKT", records[0]["source_id"])
        self.assertEqual(1709280000100, records[0]["event_time"])
        self.assertEqual(12000, records[0]["altitude"])
        self.assertEqual(463.0, records[0]["speed"])
        self.assertEqual(45.2, records[0]["heading"])
        self.assertEqual("A321", records[0]["aircraft_type"])

    def test_should_skip_stale_positions_beyond_max_seen(self):
        payload = {
            "now": 1709280000,
            "aircraft": [
                {
                    "hex": "888174",
                    "lat": 21.0285,
                    "lon": 105.8542,
                    "seen_pos": 21,
                }
            ],
        }

        records = transform_hckt_payload(payload, source_id="ADSB-HCKT", max_seen_seconds=15.0)

        self.assertEqual([], records)

    def test_should_collect_records_from_remote_json_endpoint(self):
        config = GatewayIngestConfig(
            gateway_url="http://localhost:8080",
            api_key="test-key",
            source_id="ADSB-HCKT",
        )
        connector = AdsbHcktConnector(config)

        response = Mock()
        response.json.return_value = {
            "now": 1709280000,
            "aircraft": [
                {
                    "hex": "888174",
                    "lat": 21.0285,
                    "lon": 105.8542,
                    "seen_pos": 0.0,
                }
            ],
        }
        response.raise_for_status.return_value = None

        with patch.object(connector.session, "get", return_value=response) as get_mock:
            records = connector.collect_records()

        self.assertEqual(1, len(records))
        self.assertEqual("888174", records[0]["icao"])
        self.assertEqual("ADSB-HCKT", records[0]["source_id"])
        get_mock.assert_called_once()
        self.assertEqual(3.0, connector.refresh_interval_seconds)


if __name__ == "__main__":
    unittest.main()
