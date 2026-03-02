param(
    [string]$VenvDir = ".venv",
    [string]$PythonBin = "python",
    [string]$RequirementsFile = "connectors\\requirements.txt"
)

$ErrorActionPreference = "Stop"

& $PythonBin -m venv $VenvDir
$workspaceTemp = Join-Path (Get-Location) ".tmp\python-bootstrap"
New-Item -ItemType Directory -Force -Path $workspaceTemp | Out-Null
$env:TMP = $workspaceTemp
$env:TEMP = $workspaceTemp

$venvPython = Join-Path $VenvDir "Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    $venvPython = Join-Path $VenvDir "bin\python.exe"
}
if (-not (Test-Path $venvPython)) {
    throw "Could not locate the virtual environment Python executable."
}

& $venvPython -m ensurepip --upgrade
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r $RequirementsFile
