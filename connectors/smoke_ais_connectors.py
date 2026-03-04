from __future__ import annotations

import argparse
import os
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


PLACEHOLDER_MARKERS = (
    "replace-with",
    "your-",
    "changeme",
)


@dataclass(frozen=True)
class ConnectorTarget:
    name: str
    env_file: str
    required_vars: tuple[str, ...]
    int_vars: tuple[str, ...]
    bool_vars: tuple[str, ...]
    required_dependency: str


TARGETS: Dict[str, ConnectorTarget] = {
    "aisstream": ConnectorTarget(
        name="aisstream",
        env_file="aisstream.env",
        required_vars=(
            "GATEWAY_URL",
            "API_KEY",
            "SOURCE_ID",
            "INGEST_ENDPOINT_PATH",
            "AISSTREAM_API_KEY",
            "AISSTREAM_ENDPOINT",
            "AISSTREAM_BOUNDING_BOXES",
        ),
        int_vars=(
            "MAX_RECORDS_PER_BATCH",
            "REQUEST_TIMEOUT_SECONDS",
            "RETRY_ATTEMPTS",
            "AISSTREAM_BATCH_SIZE",
            "AISSTREAM_MAX_RECONNECT_ATTEMPTS",
            "AISSTREAM_MAX_BUFFER_RECORDS",
        ),
        bool_vars=("VERIFY_TLS", "SEND_SOURCE_HEADER"),
        required_dependency="websocket",
    ),
    "signalr": ConnectorTarget(
        name="signalr",
        env_file="ais_signalr.env",
        required_vars=(
            "GATEWAY_URL",
            "API_KEY",
            "SOURCE_ID",
            "INGEST_ENDPOINT_PATH",
            "AIS_HOST",
            "AIS_QUERY",
        ),
        int_vars=(
            "MAX_RECORDS_PER_BATCH",
            "REQUEST_TIMEOUT_SECONDS",
            "RETRY_ATTEMPTS",
            "AIS_QUERY_MINUTES",
            "AIS_AUTO_TRIGGER_INTERVAL_MS",
            "AIS_SIGNALR_RECONNECT_DELAY_SECONDS",
            "AIS_SIGNALR_MAX_BUFFER_RECORDS",
        ),
        bool_vars=(
            "VERIFY_TLS",
            "SEND_SOURCE_HEADER",
            "AIS_QUERY_INCREMENTAL",
            "AIS_USING_LAST_UPDATE_TIME",
            "AIS_AUTO_TRIGGER",
        ),
        required_dependency="signalrcore.hub_connection_builder",
    ),
}


def parse_env_file(path: Path) -> Dict[str, str]:
    values: Dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def is_placeholder(value: str) -> bool:
    lowered = value.strip().lower()
    if not lowered:
        return True
    return any(marker in lowered for marker in PLACEHOLDER_MARKERS)


def validate_bool(var_name: str, value: str) -> str | None:
    lowered = value.strip().lower()
    if lowered in {"true", "false", "1", "0", "yes", "no", "on", "off"}:
        return None
    return f"{var_name}: invalid boolean value '{value}'"


def validate_positive_int(var_name: str, value: str) -> str | None:
    try:
        parsed = int(value)
    except ValueError:
        return f"{var_name}: invalid integer value '{value}'"
    if parsed <= 0:
        return f"{var_name}: must be > 0 (got {parsed})"
    return None


@contextmanager
def patched_environ(values: Dict[str, str]) -> Iterable[None]:
    original = dict(os.environ)
    try:
        os.environ.update(values)
        yield
    finally:
        os.environ.clear()
        os.environ.update(original)


def instantiate_connector(target: ConnectorTarget, env_values: Dict[str, str]) -> str | None:
    try:
        if target.name == "aisstream":
            from connectors.aisstream_connector import AisstreamConnector
        else:
            from connectors.ais_signalr_connector import AisSignalrConnector
        from connectors.common import GatewayIngestConfig
    except Exception as exc:
        return f"import failure: {exc}"

    try:
        with patched_environ(env_values):
            config = GatewayIngestConfig.from_env(default_source_id=env_values["SOURCE_ID"])
            if target.name == "aisstream":
                AisstreamConnector(config)
            else:
                AisSignalrConnector(config)
    except Exception as exc:
        return f"instantiation failure: {exc}"
    return None


def verify_dependency(module_name: str) -> str | None:
    try:
        __import__(module_name)
    except Exception as exc:
        return f"dependency missing '{module_name}': {exc}"
    return None


def run_preflight(target: ConnectorTarget, env_dir: Path, instantiate: bool) -> List[str]:
    errors: List[str] = []
    env_path = env_dir / target.env_file
    if not env_path.exists():
        return [f"missing env file: {env_path}"]

    values = parse_env_file(env_path)
    for var_name in target.required_vars:
        value = values.get(var_name, "")
        if not value:
            errors.append(f"{var_name}: missing")
            continue
        if is_placeholder(value):
            errors.append(f"{var_name}: placeholder value '{value}'")

    endpoint_path = values.get("INGEST_ENDPOINT_PATH")
    if endpoint_path and endpoint_path != "/api/v1/ingest/ais/batch":
        errors.append(
            f"INGEST_ENDPOINT_PATH: must be '/api/v1/ingest/ais/batch' (got '{endpoint_path}')"
        )

    for var_name in target.int_vars:
        value = values.get(var_name)
        if not value:
            continue
        validation_error = validate_positive_int(var_name, value)
        if validation_error:
            errors.append(validation_error)

    for var_name in target.bool_vars:
        value = values.get(var_name)
        if not value:
            continue
        validation_error = validate_bool(var_name, value)
        if validation_error:
            errors.append(validation_error)

    dependency_error = verify_dependency(target.required_dependency)
    if dependency_error:
        errors.append(dependency_error)

    if instantiate and not errors:
        instantiation_error = instantiate_connector(target, values)
        if instantiation_error:
            errors.append(instantiation_error)

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Preflight smoke check for AIS connectors.")
    parser.add_argument(
        "--connector",
        choices=("aisstream", "signalr", "both"),
        default="both",
        help="Connector target to validate.",
    )
    parser.add_argument(
        "--env-dir",
        default="connectors/env",
        help="Directory containing runtime env files.",
    )
    parser.add_argument(
        "--no-instantiate",
        action="store_true",
        help="Skip connector instantiation check.",
    )
    args = parser.parse_args()

    env_dir = Path(args.env_dir)
    targets = [TARGETS["aisstream"], TARGETS["signalr"]] if args.connector == "both" else [TARGETS[args.connector]]

    has_error = False
    for target in targets:
        errors = run_preflight(target, env_dir=env_dir, instantiate=not args.no_instantiate)
        if errors:
            has_error = True
            print(f"[FAIL] {target.name}")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"[PASS] {target.name}")

    if has_error:
        print("Preflight failed. Fix the above issues before running live connectors.")
        return 1
    print("Preflight passed. Connectors are ready for live smoke run.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
