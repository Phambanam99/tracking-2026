import unittest

from connectors.fr24_connector import merge_fr24_candidate, transform_fr24_entry


class Flightradar24ConnectorTest(unittest.TestCase):
    def test_should_transform_fr24_entry_to_ingest_record(self):
        value = [
            "abc123",
            21.0285,
            105.8542,
            45,
            35000,
            450,
            None,
            None,
            "A321",
            "VN-A123",
            1709280000,
        ]

        record = transform_fr24_entry(value, priority=True)

        self.assertIsNotNone(record)
        self.assertEqual("ABC123", record["icao"])
        self.assertEqual(1709280000000, record["event_time"])
        self.assertEqual("FR24-GLOBAL", record["source_id"])
        self.assertEqual("A321", record["aircraft_type"])
        self.assertEqual(833.4, record["speed"])
        self.assertEqual(35000, record["altitude"])
        self.assertEqual(45.0, record["heading"])

    def test_should_prefer_newer_and_richer_candidate(self):
        current = {"icao": "ABC123", "lat": 1.0, "lon": 2.0, "event_time": 1709280000000, "_priority": 0}
        candidate = {
            "icao": "ABC123",
            "lat": 1.1,
            "lon": 2.1,
            "event_time": 1709280005000,
            "altitude": 35000,
            "speed": 800.0,
            "_priority": 1,
        }

        merged = merge_fr24_candidate(current, candidate)

        self.assertEqual(candidate, merged)


if __name__ == "__main__":
    unittest.main()
