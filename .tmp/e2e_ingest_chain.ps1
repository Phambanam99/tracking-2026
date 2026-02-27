param([string]$Icao,[long]$EventTime)
$body = '{"icao":"' + $Icao + '","lat":21.12,"lon":105.91,"altitude":28000,"speed":390.0,"heading":60.0,"event_time":' + $EventTime + ',"source_id":"radar-ingest"}'
$headers = @{ 'x-request-id'='e2e-chain-req-1'; 'traceparent'='00-cccccccccccccccccccccccccccccccc-dddddddddddddddd-01' }
$resp = Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'http://localhost:18082/api/v1/ingest/adsb' -Headers $headers -ContentType 'application/json' -Body $body
Write-Output ($resp.StatusCode)
Write-Output ($resp.Content)
