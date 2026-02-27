$ErrorActionPreference = "Stop"

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [int]$TimeoutSec = 5
    )

    try {
        if ($null -ne $Body) {
            $json = $Body | ConvertTo-Json -Depth 10 -Compress
            $resp = Invoke-WebRequest -UseBasicParsing -Method $Method -Uri $Uri -Headers $Headers -ContentType "application/json" -Body $json -TimeoutSec $TimeoutSec
        } else {
            $resp = Invoke-WebRequest -UseBasicParsing -Method $Method -Uri $Uri -Headers $Headers -TimeoutSec $TimeoutSec
        }

        return [pscustomobject]@{
            Status = [int]$resp.StatusCode
            Body = $resp.Content
        }
    } catch {
        $status = 0
        $content = ""
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode.value__
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($null -ne $stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $content = $reader.ReadToEnd()
                    $reader.Close()
                }
            } catch {
                $content = ""
            }
        }

        return [pscustomobject]@{
            Status = $status
            Body = $content
        }
    }
}

function Get-RevocationMetric {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:18082/actuator/prometheus" -TimeoutSec 5
    $line = ($resp.Content -split "`n" | Where-Object { $_ -match '^tracking_ingestion_revocation_applied_total' } | Select-Object -First 1)
    if (-not $line) {
        return 0.0
    }

    $value = $line -split '\s+' | Select-Object -Last 1
    return [double]$value
}

$gateway = "http://localhost:18080"
$ingestion = "http://localhost:18082"
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$sourceId = "radar-e2e-$ts"

$jwks = Invoke-Api -Method GET -Uri "$gateway/api/v1/auth/.well-known/jwks.json"
Write-Output "JWKS_STATUS=$($jwks.Status)"

$loginBody = @{
    username = "admin"
    password = "Admin@12345678"
}
$login = Invoke-Api -Method POST -Uri "$gateway/api/v1/auth/login" -Body $loginBody
Write-Output "LOGIN_STATUS=$($login.Status)"
if ($login.Status -ne 200) {
    Write-Output "LOGIN_BODY=$($login.Body)"
    exit 1
}

$tokens = $login.Body | ConvertFrom-Json
$accessToken = [string]$tokens.accessToken

$authHeaders = @{ Authorization = "Bearer $accessToken" }
$create = Invoke-Api -Method POST -Uri "$gateway/api/v1/auth/api-keys" -Headers $authHeaders -Body @{ sourceId = $sourceId }
Write-Output "CREATE_KEY_STATUS=$($create.Status)"
if ($create.Status -ne 200) {
    Write-Output "CREATE_KEY_BODY=$($create.Body)"
    exit 1
}

$keyObj = $create.Body | ConvertFrom-Json
$apiKey = [string]$keyObj.apiKey
$apiKeyId = [int64]$keyObj.id
Write-Output "API_KEY_ID=$apiKeyId"
Write-Output "SOURCE_ID=$sourceId"

$payload = @{
    icao = "ABC123"
    lat = 10.123
    lon = 106.321
    altitude = 32000
    speed = 450.5
    heading = 180.0
    event_time = $ts
    source_id = $sourceId
}
$apiKeyHeaders = @{ "x-api-key" = $apiKey }

$ingGwBefore = Invoke-Api -Method POST -Uri "$gateway/api/v1/ingest/adsb" -Headers $apiKeyHeaders -Body $payload
$ingDirectBefore = Invoke-Api -Method POST -Uri "$ingestion/api/v1/ingest/adsb" -Headers $apiKeyHeaders -Body $payload
Write-Output "INGEST_GW_BEFORE_STATUS=$($ingGwBefore.Status)"
Write-Output "INGEST_DIRECT_BEFORE_STATUS=$($ingDirectBefore.Status)"

$loginPayloadJson = $loginBody | ConvertTo-Json -Compress
$jobs = 1..80 | ForEach-Object {
    Start-Job -ScriptBlock {
        param($bodyJson)
        try {
            $resp = Invoke-WebRequest -UseBasicParsing -Method POST -Uri "http://localhost:18080/api/v1/auth/login" -ContentType "application/json" -Body $bodyJson -TimeoutSec 10
            [int]$resp.StatusCode
        } catch {
            if ($_.Exception.Response) {
                [int]$_.Exception.Response.StatusCode.value__
            } else {
                0
            }
        }
    } -ArgumentList $loginPayloadJson
}
Wait-Job -Job $jobs | Out-Null
$rateCodes = Receive-Job -Job $jobs
Remove-Job -Job $jobs
$rate429 = @($rateCodes | Where-Object { $_ -eq 429 }).Count
$rate200 = @($rateCodes | Where-Object { $_ -eq 200 }).Count
Write-Output "RATE_LIMIT_200_COUNT=$rate200"
Write-Output "RATE_LIMIT_429_COUNT=$rate429"

$metricBefore = Get-RevocationMetric
Write-Output ("REVOCATION_METRIC_BEFORE={0}" -f $metricBefore)

$revoke = Invoke-Api -Method POST -Uri "$gateway/api/v1/auth/api-keys/$apiKeyId/revoke" -Headers $authHeaders
Write-Output "REVOKE_STATUS=$($revoke.Status)"

$gwDeniedLatencyMs = -1
$gwWatch = [System.Diagnostics.Stopwatch]::StartNew()
for ($i = 1; $i -le 30; $i++) {
    $r = Invoke-Api -Method POST -Uri "$gateway/api/v1/ingest/adsb" -Headers $apiKeyHeaders -Body $payload
    if ($r.Status -eq 401) {
        $gwDeniedLatencyMs = $gwWatch.ElapsedMilliseconds
        break
    }
    Start-Sleep -Milliseconds 300
}
Write-Output "GW_DENY_LATENCY_MS=$gwDeniedLatencyMs"

$ingDeniedLatencyMs = -1
$ingWatch = [System.Diagnostics.Stopwatch]::StartNew()
for ($i = 1; $i -le 30; $i++) {
    $r = Invoke-Api -Method POST -Uri "$ingestion/api/v1/ingest/adsb" -Headers $apiKeyHeaders -Body $payload
    if ($r.Status -eq 401) {
        $ingDeniedLatencyMs = $ingWatch.ElapsedMilliseconds
        break
    }
    Start-Sleep -Milliseconds 300
}
Write-Output "INGEST_DENY_LATENCY_MS=$ingDeniedLatencyMs"

$metricAfter = Get-RevocationMetric
$metricDelta = $metricAfter - $metricBefore
Write-Output ("REVOCATION_METRIC_AFTER={0}" -f $metricAfter)
Write-Output ("REVOCATION_METRIC_DELTA={0}" -f $metricDelta)
