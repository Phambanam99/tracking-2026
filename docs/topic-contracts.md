# Kafka Topic Contracts

## raw-adsb
- Key: `icao`
- Value: `CanonicalFlight`

## live-adsb
- Key: `icao`
- Value: `EnrichedFlight` (`isHistorical = false`)

## historical-adsb
- Key: `icao`
- Value: `EnrichedFlight` (`isHistorical = true`)

## invalid-telemetry-dlq
- Key: `icao`
- Value: `InvalidFlightRecord` (`reason`, `flight`, `previousFlight`, `computedSpeedKmh`)

## auth-revocation
- Key: principal/api-key-id
- Value: event revoke để đồng bộ cache tại gateway/ingestion
