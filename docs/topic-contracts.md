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

## invalid-telemetry-dlq
- Key: `icao`
- Value: `InvalidFlightRecord`
- Fields include: `reason`, `flight`, `previousFlight`, `computedSpeedKmh`

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
