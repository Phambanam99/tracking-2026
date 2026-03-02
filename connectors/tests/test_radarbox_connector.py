import unittest

from connectors.radarbox_connector import transform_radarbox_flight


class RadarBoxConnectorTest(unittest.TestCase):
    def test_should_transform_radarbox_flight_to_ingest_record(self):
        flight = {
            "ms": "888123",
            "la": 21.0285,
            "lo": 105.8542,
            "hd": 90,
            "alt": 12000,
            "gs": 500,
            "t": 1709280000123,
            "act": "A321",
        }

        record = transform_radarbox_flight(flight, speed_unit="knots")

        self.assertIsNotNone(record)
        self.assertEqual("888123", record["icao"])
        self.assertEqual(1709280000123, record["event_time"])
        self.assertEqual("RADARBOX-GLOBAL", record["source_id"])
        self.assertEqual("A321", record["aircraft_type"])
        self.assertEqual(926.0, record["speed"])
        self.assertEqual(90.0, record["heading"])

    def test_should_reject_missing_hexident(self):
        self.assertIsNone(transform_radarbox_flight({"la": 1.0, "lo": 2.0, "t": 1709280000123}))

    def test_should_drop_non_finite_speed(self):
        flight = {
            "ms": "888123",
            "la": 21.0285,
            "lo": 105.8542,
            "gs": float("inf"),
            "hd": 90,
            "t": 1709280000123,
        }

        record = transform_radarbox_flight(flight, speed_unit="knots")

        self.assertIsNotNone(record)
        self.assertNotIn("speed", record)
        self.assertEqual(90.0, record["heading"])

    def test_should_drop_altitude_outside_int_range(self):
        flight = {
            "ms": "888123",
            "la": 21.0285,
            "lo": 105.8542,
            "alt": 18446744073709551616,
            "t": 1709280000123,
        }

        record = transform_radarbox_flight(flight, speed_unit="knots")

        self.assertIsNotNone(record)
        self.assertNotIn("altitude", record)


if __name__ == "__main__":
    unittest.main()
