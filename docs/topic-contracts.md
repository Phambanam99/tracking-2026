# Kafka Topic Contracts

## raw-adsb
- Key: `icao`
- Value: `CanonicalFlight`
- Wire keys: `snake_case`

Example:

```json
{
  "icao": "ABC123",
  "lat": 21.0285,
  "lon": 105.8542,
  "event_time": 1708941600000,
  "source_id": "FR24-GLOBAL"
}
```

## live-adsb
- Key: `icao`
- Value: `EnrichedFlight`
- Semantic constraint: `is_historical = false`
- Wire keys: `snake_case`

Example:

```json
{
  "icao": "ABC123",
  "lat": 21.0285,
  "lon": 105.8542,
  "event_time": 1708941600000,
  "source_id": "FR24-GLOBAL",
  "is_historical": false,
  "metadata": {
    "registration": "VN-A321",
    "aircraft_type": "A321",
    "operator": "Vietnam Airlines",
    "country_code": "VN"
  }
}
```

## historical-adsb
- Key: `icao`
- Value: `EnrichedFlight`
- Semantic constraint: `is_historical = true`
- Wire keys: `snake_case`

Example:

```json
{
  "icao": "ABC123",
  "lat": 21.0285,
  "lon": 105.8542,
  "event_time": 1708941600000,
  "source_id": "FR24-GLOBAL",
  "is_historical": true
}
```

## raw-ais
- Key: `mmsi`
- Value: `CanonicalShip`
- Semantic constraint: raw telemetry only; do not treat vessel profile as mandatory in this topic
- Wire keys: `snake_case`

Example:

```json
{
  "mmsi": "574001230",
  "lat": 10.7769,
  "lon": 106.7009,
  "speed": 12.4,
  "course": 182.5,
  "heading": 180.0,
  "nav_status": "under_way_using_engine",
  "vessel_name": "PACIFIC TRADER",
  "vessel_type": "cargo",
  "imo": "9876543",
  "call_sign": "3WAB2",
  "destination": "SG SIN",
  "eta": 1708945200000,
  "event_time": 1708941600000,
  "source_id": "AIS-PRIMARY",
  "score": 0.98
}
```

## live-ais
- Key: `mmsi`
- Value: `EnrichedShip`
- Semantic constraint: `is_historical = false`
- Wire keys: `snake_case`

Example:

```json
{
  "mmsi": "574001230",
  "lat": 10.7769,
  "lon": 106.7009,
  "speed": 12.4,
  "course": 182.5,
  "heading": 180.0,
  "nav_status": "under_way_using_engine",
  "vessel_name": "PACIFIC TRADER",
  "vessel_type": "cargo",
  "imo": "9876543",
  "call_sign": "3WAB2",
  "destination": "SG SIN",
  "eta": 1708945200000,
  "event_time": 1708941600000,
  "source_id": "AIS-PRIMARY",
  "is_historical": false,
  "score": 0.98,
  "metadata": {
    "flag_country": "Vietnam",
    "flag_url": "https://static.example.test/flags/vn.svg",
    "ship_type_name": "Cargo Vessel",
    "is_military": false
  }
}
```

## historical-ais
- Key: `mmsi`
- Value: `EnrichedShip`
- Semantic constraint: `is_historical = true`
- Wire keys: `snake_case`

Example:

```json
{
  "mmsi": "574001230",
  "lat": 10.7769,
  "lon": 106.7009,
  "event_time": 1708941600000,
  "source_id": "AIS-PRIMARY",
  "is_historical": true
}
```

## invalid-telemetry-dlq
- Key: domain identifier, currently `icao` for flight and `mmsi` for ship
- Value: domain-specific invalid record payload
- Flight payload fields include: `reason`, `flight`, `previousFlight`, `computedSpeedKmh`
- Ship payload fields should mirror the same semantics: `reason`, `ship`, `previousShip`, `computedSpeedKmh`

## auth-revocation
- Key: principal or api-key id
- Value: revocation event used to synchronize cache state in gateway and ingestion

## WebSocket `/user/topic/flights`
- Value: `LiveFlightMessage`
- Wire keys: `snake_case`

Example:

```json
{
  "sent_at": 1700000000123,
  "flight": {
    "icao": "ABC123",
    "lat": 21.0285,
    "lon": 105.8542,
    "event_time": 1708941600000,
    "source_id": "FR24-GLOBAL",
    "is_historical": false
  }
}
```

## WebSocket `/user/topic/ships`
- Value: `LiveShipMessage`
- Wire keys: `snake_case`

Example:

```json
{
  "sent_at": 1700000000123,
  "ship": {
    "mmsi": "574001230",
    "lat": 10.7769,
    "lon": 106.7009,
    "event_time": 1708941600000,
    "source_id": "AIS-PRIMARY",
    "is_historical": false
  }
}
```
