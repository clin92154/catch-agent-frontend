param(
    [ValidateSet("up", "down", "restart", "logs", "ps")]
    [string]$Action = "up"
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

# Always run Compose from the frontend directory so relative paths stay valid.
switch ($Action) {
    "up" {
        docker compose up --build -d
        if ($LASTEXITCODE -eq 0) { docker compose ps }
    }
    "down" {
        docker compose down
    }
    "restart" {
        docker compose down
        if ($LASTEXITCODE -eq 0) { docker compose up --build -d }
        if ($LASTEXITCODE -eq 0) { docker compose ps }
    }
    "logs" {
        docker compose logs --follow frontend
    }
    "ps" {
        docker compose ps
    }
}

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
