#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <adsbx|adsb-hckt|fr24|radarbox|chinaport|aisstream|signalr>" >&2
  exit 1
fi

CONNECTOR_NAME="$1"
PYTHON_BIN="${PYTHON_BIN:-python3}"

case "$CONNECTOR_NAME" in
  adsbx)
    SCRIPT="connectors/adsbx_connector.py"
    ;;
  adsb-hckt)
    SCRIPT="connectors/adsb_hckt_connector.py"
    ;;
  fr24)
    SCRIPT="connectors/fr24_connector.py"
    ;;
  radarbox)
    SCRIPT="connectors/radarbox_connector.py"
    ;;
  chinaport)
    SCRIPT="connectors/chinaport_connector.py"
    ;;
  aisstream)
    SCRIPT="connectors/aisstream_connector.py"
    ;;
  signalr)
    SCRIPT="connectors/ais_signalr_connector.py"
    ;;
  *)
    echo "Unknown connector: $CONNECTOR_NAME" >&2
    exit 1
    ;;
esac

exec "$PYTHON_BIN" "$SCRIPT"
