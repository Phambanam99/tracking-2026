param(
    [string]$PythonBin = ".venv\\Scripts\\python.exe"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $PythonBin)) {
    $candidate = ".venv\\bin\\python.exe"
    if (Test-Path $candidate) {
        $PythonBin = $candidate
    }
}

& $PythonBin -m unittest discover -s "connectors/tests" -p "test_*.py" -v
