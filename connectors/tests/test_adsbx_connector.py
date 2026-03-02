import sys
import types
import unittest

from unittest.mock import patch

from connectors.adsbx_connector import (
    AdsbExchangeConnector,
    _detect_chrome_major_version,
    _ensure_undetected_chromedriver_compat,
    transform_adsbx_aircraft_list,
)
from connectors.common import GatewayIngestConfig


class AdsbExchangeConnectorTest(unittest.TestCase):
    def test_should_transform_aircraft_list_with_snapshot_time(self):
        aircraft = [
            {
                "icao": "888123",
                "lat": 21.0285,
                "lon": 105.8542,
                "altitude": 12000,
                "speed": 750.5,
                "heading": 45.0,
            }
        ]

        records = transform_adsbx_aircraft_list(aircraft, snapshot_ms=1709280000123, include_derived_speed_heading=False)

        self.assertEqual(1, len(records))
        self.assertEqual("888123", records[0]["icao"])
        self.assertEqual(1709280000123, records[0]["event_time"])
        self.assertEqual("ADSBX-SNAPSHOT", records[0]["source_id"])
        self.assertEqual(12000, records[0]["altitude"])
        self.assertNotIn("speed", records[0])
        self.assertNotIn("heading", records[0])

    def test_should_include_derived_speed_heading_only_when_enabled(self):
        aircraft = [{"icao": "ABC123", "lat": 1.0, "lon": 2.0, "speed": 123.4, "heading": 180.0}]

        records = transform_adsbx_aircraft_list(aircraft, snapshot_ms=1, include_derived_speed_heading=True)

        self.assertEqual("ADSBX-SNAPSHOT", records[0]["source_id"])
        self.assertEqual(123.4, records[0]["speed"])
        self.assertEqual(180.0, records[0]["heading"])

    def test_should_install_distutils_compat_shim_when_missing(self):
        original_distutils = sys.modules.pop("distutils", None)
        original_version = sys.modules.pop("distutils.version", None)
        shim_module = types.SimpleNamespace(version=types.SimpleNamespace(LooseVersion=object))
        original_setuptools = sys.modules.get("setuptools")
        sys.modules["setuptools"] = types.SimpleNamespace(_distutils=shim_module)
        try:
            _ensure_undetected_chromedriver_compat()
            self.assertIs(sys.modules["distutils"], shim_module)
            self.assertIs(sys.modules["distutils.version"], shim_module.version)
        finally:
            if original_distutils is not None:
                sys.modules["distutils"] = original_distutils
            else:
                sys.modules.pop("distutils", None)
            if original_version is not None:
                sys.modules["distutils.version"] = original_version
            else:
                sys.modules.pop("distutils.version", None)
            if original_setuptools is not None:
                sys.modules["setuptools"] = original_setuptools
            else:
                sys.modules.pop("setuptools", None)

    def test_should_detect_chrome_major_version(self):
        with patch("connectors.adsbx_connector.subprocess.check_output", return_value="Chromium 145.0.7632.116"):
            self.assertEqual(145, _detect_chrome_major_version("/usr/bin/chromium"))

    def test_should_enable_derived_speed_heading_by_default(self):
        config = GatewayIngestConfig(
            gateway_url="http://localhost:8080",
            api_key="test-key",
            source_id="ADSBX-SNAPSHOT",
        )

        with patch("connectors.adsbx_connector.BaseConnector.__init__", return_value=None):
            connector = AdsbExchangeConnector(config)

        self.assertTrue(connector.include_derived_speed_heading)


if __name__ == "__main__":
    unittest.main()
