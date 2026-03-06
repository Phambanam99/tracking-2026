#!/usr/bin/env bash
# =============================================================================
# geoserver-init.sh — Tự động tạo workspace, store, publish layers trên GeoServer
# Usage: bash geoserver-init.sh
# =============================================================================
set -euo pipefail

GEOSERVER_URL="${GEOSERVER_URL:-http://localhost:8600/geoserver}"
GEOSERVER_USER="${GEOSERVER_USER:-admin}"
GEOSERVER_PASS="${GEOSERVER_PASS:-geoserver}"
WORKSPACE="tracking"
STORE_NAME="natural-earth-10m"
GEODATA_PATH="/opt/geoserver/geodata"

AUTH="${GEOSERVER_USER}:${GEOSERVER_PASS}"
REST="${GEOSERVER_URL}/rest"

log() { echo -e "\033[1;36m[$(date '+%H:%M:%S')] $*\033[0m"; }
ok()  { echo -e "\033[1;32m[$(date '+%H:%M:%S')] ✓ $*\033[0m"; }
err() { echo -e "\033[1;31m[$(date '+%H:%M:%S')] ✗ $*\033[0m" >&2; }

# ─── Wait for GeoServer ──────────────────────────────────────────────────────
log "Waiting for GeoServer at ${GEOSERVER_URL}..."
for i in $(seq 1 30); do
  if curl -sf -u "$AUTH" "${REST}/about/version.json" > /dev/null 2>&1; then
    ok "GeoServer is ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    err "GeoServer not reachable after 60s"
    exit 1
  fi
  sleep 2
done

# ─── Create Workspace ────────────────────────────────────────────────────────
log "Creating workspace '${WORKSPACE}'..."
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -u "$AUTH" \
  -X POST "${REST}/workspaces" \
  -H "Content-Type: application/json" \
  -d "{\"workspace\":{\"name\":\"${WORKSPACE}\"}}" 2>/dev/null || true)

if [ "$STATUS" = "201" ]; then
  ok "Workspace '${WORKSPACE}' created"
elif [ "$STATUS" = "401" ]; then
  err "Authentication failed"
  exit 1
else
  log "Workspace '${WORKSPACE}' already exists (status: ${STATUS})"
fi

# ─── Set as default workspace ────────────────────────────────────────────────
curl -sf -o /dev/null -u "$AUTH" \
  -X PUT "${REST}/workspaces/${WORKSPACE}" \
  -H "Content-Type: application/json" \
  -d "{\"workspace\":{\"name\":\"${WORKSPACE}\"}}" 2>/dev/null || true

# ─── Create Shapefile Directory Store ─────────────────────────────────────────
log "Creating store '${STORE_NAME}'..."
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -u "$AUTH" \
  -X POST "${REST}/workspaces/${WORKSPACE}/datastores" \
  -H "Content-Type: application/json" \
  -d "{
    \"dataStore\": {
      \"name\": \"${STORE_NAME}\",
      \"type\": \"Directory of spatial files (shapefiles)\",
      \"connectionParameters\": {
        \"entry\": [
          {\"@key\": \"url\", \"\$\": \"file://${GEODATA_PATH}\"},
          {\"@key\": \"charset\", \"\$\": \"UTF-8\"}
        ]
      }
    }
  }" 2>/dev/null || true)

if [ "$STATUS" = "201" ]; then
  ok "Store '${STORE_NAME}' created"
else
  log "Store '${STORE_NAME}' already exists (status: ${STATUS})"
fi

# ─── Publish all layers ───────────────────────────────────────────────────────
log "Fetching available feature types..."
FEATURES=$(curl -sf -u "$AUTH" \
  "${REST}/workspaces/${WORKSPACE}/datastores/${STORE_NAME}/featuretypes.json?list=available" 2>/dev/null || echo "")

if [ -z "$FEATURES" ]; then
  err "Cannot retrieve feature types. Check store configuration."
  exit 1
fi

# Parse feature names from JSON
LAYER_NAMES=$(echo "$FEATURES" | python3 -c "
import sys, json
data = json.load(sys.stdin)
names = data.get('list', {}).get('string', [])
if isinstance(names, str):
    names = [names]
for n in names:
    print(n)
" 2>/dev/null || echo "")

if [ -z "$LAYER_NAMES" ]; then
  log "No unpublished layers found (all may already be published)"
  LAYER_NAMES=""
fi

PUBLISHED=0
FAILED=0

while IFS= read -r LAYER_NAME; do
  [ -z "$LAYER_NAME" ] && continue

  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -u "$AUTH" \
    -X POST "${REST}/workspaces/${WORKSPACE}/datastores/${STORE_NAME}/featuretypes" \
    -H "Content-Type: application/json" \
    -d "{
      \"featureType\": {
        \"name\": \"${LAYER_NAME}\",
        \"nativeName\": \"${LAYER_NAME}\",
        \"srs\": \"EPSG:4326\",
        \"projectionPolicy\": \"FORCE_DECLARED\"
      }
    }" 2>/dev/null || true)

  if [ "$STATUS" = "201" ]; then
    PUBLISHED=$((PUBLISHED + 1))
  else
    FAILED=$((FAILED + 1))
  fi
done <<< "$LAYER_NAMES"

ok "Published ${PUBLISHED} layers (${FAILED} skipped/already exist)"

# ─── Create Layer Group ───────────────────────────────────────────────────────
log "Creating layer group 'basemap'..."

# Key layers for basemap (order matters: bottom to top)
BASEMAP_LAYERS=(
  "ne_10m_admin_0_countries"
  "ne_10m_admin_1_states_provinces"
  "ne_10m_populated_places_simple"
  "ne_10m_roads"
  "ne_10m_airports"
  "ne_10m_ports"
)

# Build layers JSON array
LAYERS_JSON=""
for LAYER in "${BASEMAP_LAYERS[@]}"; do
  if [ -n "$LAYERS_JSON" ]; then
    LAYERS_JSON="${LAYERS_JSON},"
  fi
  LAYERS_JSON="${LAYERS_JSON}{\"@type\":\"layer\",\"name\":\"${WORKSPACE}:${LAYER}\"}"
done

# Build styles JSON array (empty = use default style for each layer)
STYLES_JSON=""
for LAYER in "${BASEMAP_LAYERS[@]}"; do
  if [ -n "$STYLES_JSON" ]; then
    STYLES_JSON="${STYLES_JSON},"
  fi
  STYLES_JSON="${STYLES_JSON}{\"name\":\"\"}"
done

STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -u "$AUTH" \
  -X POST "${REST}/workspaces/${WORKSPACE}/layergroups" \
  -H "Content-Type: application/json" \
  -d "{
    \"layerGroup\": {
      \"name\": \"basemap\",
      \"title\": \"Basemap\",
      \"mode\": \"SINGLE\",
      \"publishables\": {
        \"published\": [${LAYERS_JSON}]
      },
      \"styles\": {
        \"style\": [${STYLES_JSON}]
      }
    }
  }" 2>/dev/null || true)

if [ "$STATUS" = "201" ]; then
  ok "Layer group 'basemap' created"
else
  log "Layer group 'basemap' already exists (status: ${STATUS})"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
ok "GeoServer initialization complete!"
echo "  Workspace:   ${WORKSPACE}"
echo "  Store:       ${STORE_NAME}"
echo "  Layers:      ${PUBLISHED} published"
echo "  Layer Group: ${WORKSPACE}:basemap"
echo ""
echo "  Preview:     ${GEOSERVER_URL}/${WORKSPACE}/wms?service=WMS&version=1.1.1&request=GetMap&layers=${WORKSPACE}:basemap&bbox=-180,-90,180,90&width=800&height=400&srs=EPSG:4326&format=image/png"
echo ""
