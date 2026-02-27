$ports = @(18082, 18083, 18084)
foreach ($p in $ports) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri ("http://localhost:{0}/actuator/health" -f $p)
    Write-Output ("{0} {1}" -f $p, $resp.StatusCode)
  } catch {
    if ($_.Exception.Response -ne $null) {
      Write-Output ("{0} {1}" -f $p, $_.Exception.Response.StatusCode.value__)
    } else {
      Write-Output ("{0} 000" -f $p)
    }
  }
}
