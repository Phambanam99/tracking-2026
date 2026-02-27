param([string]$Icao,[long]$EventTime)
$body = '{"icao":"' + $Icao + '","lat":21.0285,"lon":105.8542,"altitude":33000,"speed":450.0,"heading":90.0,"event_time":' + $EventTime + ',"source_id":"radar-e2e"}'
$headers = @{ 'x-request-id'='e2e-req-p6-1'; 'traceparent'='00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01' }
$resp = Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'http://localhost:18082/api/v1/ingest/adsb' -Headers $headers -ContentType 'application/json' -Body $body
Write-Output ($resp.StatusCode)
Write-Output ($resp.Content)
