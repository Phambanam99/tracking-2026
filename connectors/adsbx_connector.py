from __future__ import annotations

import base64
import os
import re
import struct
import subprocess
import sys
import time
from typing import Any, Dict, List, Optional

try:
    from connectors.common import (
        BaseConnector,
        GatewayIngestConfig,
        configure_logging,
        normalize_heading,
        normalize_hex_icao,
        normalize_positive_int,
        validate_lat_lon,
    )
except ImportError:  # pragma: no cover
    from common import (  # type: ignore
        BaseConnector,
        GatewayIngestConfig,
        configure_logging,
        normalize_heading,
        normalize_hex_icao,
        normalize_positive_int,
        validate_lat_lon,
    )


ADSBX_FETCH_SCRIPT = r"""
const callback = arguments[arguments.length - 1];
(async () => {
  try {
    const response = await fetch('https://globe.adsbexchange.com/re-api/?binCraft&zstd&box=-90,90,-180,180');
    if (!response.ok) {
      callback({status: response.status, error: 'HTTP error'});
      return;
    }
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, offset + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    callback({status: 200, data: btoa(binary), size: buffer.byteLength});
  } catch (error) {
    callback({status: 500, error: String(error)});
  }
})();
"""


class AdsbExchangeConnector(BaseConnector):
    def __init__(self, config: GatewayIngestConfig) -> None:
        refresh_interval_seconds = float(os.getenv("ADSBX_REFRESH_INTERVAL_SECONDS", "60"))
        super().__init__(name="ADSBX-SNAPSHOT", config=config, refresh_interval_seconds=refresh_interval_seconds)
        self.browser = None
        self.include_derived_speed_heading = os.getenv("ADSBX_INCLUDE_DERIVED_SPEED_HEADING", "true").lower() in {
            "1",
            "true",
            "yes",
        }
        self.url = os.getenv("ADSBX_URL", "https://globe.adsbexchange.com")
        self.headless = os.getenv("ADSBX_HEADLESS", "true").lower() not in {"0", "false", "no"}

    def collect_records(self) -> List[Dict[str, Any]]:
        browser = self._ensure_browser()
        browser.get(self.url)
        time.sleep(5)
        result = browser.execute_async_script(ADSBX_FETCH_SCRIPT)
        if not result or result.get("status") != 200:
            raise RuntimeError(f"ADSBX fetch failed: {result}")

        try:
            import zstandard as zstd  # type: ignore
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError("zstandard is required for ADSBX connector") from exc

        binary_data = base64.b64decode(result["data"])
        decompressed = zstd.ZstdDecompressor().decompress(binary_data)
        aircraft = decode_bincraft(decompressed)
        snapshot_ms = int(time.time() * 1000)
        return transform_adsbx_aircraft_list(
            aircraft,
            snapshot_ms=snapshot_ms,
            include_derived_speed_heading=self.include_derived_speed_heading,
        )

    def stop(self) -> None:
        super().stop()
        if self.browser is not None:
            try:
                self.browser.quit()
            except Exception:
                pass
            self.browser = None

    def _ensure_browser(self):
        if self.browser is not None:
            return self.browser

        _ensure_undetected_chromedriver_compat()
        try:
            import undetected_chromedriver as uc  # type: ignore
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError("undetected-chromedriver is required for ADSBX connector") from exc

        options = uc.ChromeOptions()
        options.add_argument("--window-size=1280,800")
        options.add_argument("--disable-notifications")
        options.add_argument("--no-first-run")
        options.add_argument("--disable-dev-shm-usage")
        if self.headless:
            options.add_argument("--headless=new")
            options.add_argument("--disable-gpu")
            options.add_argument("--no-sandbox")

        chrome_binary = os.getenv("ADSBX_CHROME_BINARY", "").strip()
        browser_kwargs: Dict[str, Any] = {"options": options, "use_subprocess": True, "headless": self.headless}
        if chrome_binary:
            options.binary_location = chrome_binary
            browser_kwargs["browser_executable_path"] = chrome_binary
            chrome_major_version = _detect_chrome_major_version(chrome_binary)
            if chrome_major_version is not None:
                browser_kwargs["version_main"] = chrome_major_version

        self.browser = uc.Chrome(**browser_kwargs)
        return self.browser


def _ensure_undetected_chromedriver_compat() -> None:
    try:
        import distutils.version  # type: ignore  # noqa: F401
        return
    except ImportError:
        pass

    try:
        import setuptools  # type: ignore
        setuptools_distutils = getattr(setuptools, "_distutils", None)
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("setuptools is required for ADSBX connector compatibility") from exc

    if setuptools_distutils is None:  # pragma: no cover
        raise RuntimeError("setuptools is required for ADSBX connector compatibility")

    sys.modules.setdefault("distutils", setuptools_distutils)
    sys.modules.setdefault("distutils.version", setuptools_distutils.version)


def _detect_chrome_major_version(chrome_binary: str) -> Optional[int]:
    try:
        output = subprocess.check_output([chrome_binary, "--version"], text=True, stderr=subprocess.STDOUT).strip()
    except (OSError, subprocess.CalledProcessError):
        return None

    match = re.search(r"(\d+)\.", output)
    if match is None:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def decode_bincraft(buffer: bytes) -> List[Dict[str, Any]]:
    aircraft: List[Dict[str, Any]] = []
    if len(buffer) < 48:
        return aircraft

    try:
        header = struct.unpack("<12I", buffer[0:48])
        stride = header[2]
    except struct.error:
        return aircraft

    if stride < 40 or stride > 200:
        return aircraft

    offset = stride
    while offset + stride <= len(buffer):
        record = buffer[offset : offset + stride]
        decoded = _decode_bincraft_record(record, stride)
        if decoded is not None:
            aircraft.append(decoded)
        offset += stride
    return aircraft


def _decode_bincraft_record(record: bytes, stride: int) -> Optional[Dict[str, Any]]:
    try:
        if stride == 56:
            hex_raw = struct.unpack("<I", record[0:4])[0] & 0xFFFFFF
            icao = f"{hex_raw:06X}"

            lat = struct.unpack("<i", record[8:12])[0] / 1e6
            lon = struct.unpack("<i", record[4:8])[0] / 1e6
            if validate_lat_lon(lat, lon) is None:
                lat = struct.unpack("<i", record[4:8])[0] / 1e6
                lon = struct.unpack("<i", record[8:12])[0] / 1e6

            altitude = struct.unpack("<h", record[12:14])[0] * 25
            speed = struct.unpack("<h", record[14:16])[0] / 10
            heading = struct.unpack("<h", record[16:18])[0] / 90
        else:
            ints = struct.unpack("<" + ("i" * min(stride // 4, 28)), record[: min(stride, 112)])
            shorts = struct.unpack("<" + ("h" * min(stride // 2, 56)), record[: min(stride, 112)])
            hex_raw = ints[0] & 0xFFFFFF
            icao = f"{hex_raw:06X}"
            lon = ints[2] / 1e6
            lat = ints[3] / 1e6
            altitude = 25 * shorts[10] if len(shorts) > 10 else None
            speed = shorts[17] / 10 if len(shorts) > 17 else None
            heading = shorts[20] / 90 if len(shorts) > 20 else None

        coords = validate_lat_lon(lat, lon)
        if coords is None:
            return None
        lat_value, lon_value = coords

        return {
            "icao": icao,
            "lat": lat_value,
            "lon": lon_value,
            "altitude": altitude,
            "speed": speed,
            "heading": heading,
        }
    except Exception:
        return None


def transform_adsbx_aircraft_list(
    aircraft: List[Dict[str, Any]],
    snapshot_ms: int,
    include_derived_speed_heading: bool = False,
) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    for entry in aircraft:
        icao = normalize_hex_icao(entry.get("icao"))
        coords = validate_lat_lon(entry.get("lat"), entry.get("lon"))
        if icao is None or coords is None:
            continue
        lat, lon = coords
        record: Dict[str, Any] = {
            "icao": icao,
            "lat": lat,
            "lon": lon,
            "event_time": snapshot_ms,
            "source_id": "ADSBX-SNAPSHOT",
        }

        altitude = normalize_positive_int(entry.get("altitude"))
        if altitude is not None:
            record["altitude"] = altitude

        if include_derived_speed_heading:
            raw_speed = entry.get("speed")
            raw_heading = entry.get("heading")
            if raw_speed is not None:
                try:
                    speed_value = float(raw_speed)
                except (TypeError, ValueError):
                    speed_value = None
                if speed_value is not None and speed_value >= 0:
                    record["speed"] = round(speed_value, 1)
            heading = normalize_heading(raw_heading)
            if heading is not None:
                record["heading"] = heading

        records.append(record)
    return records


def main() -> None:
    configure_logging()
    config = GatewayIngestConfig.from_env(default_source_id="ADSBX-SNAPSHOT")
    connector = AdsbExchangeConnector(config)
    try:
        connector.run_forever()
    finally:
        connector.stop()


if __name__ == "__main__":
    main()
