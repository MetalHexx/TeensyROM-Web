$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$sidablist = Join-Path $root '..\..\SIDablist'

if (-not (Test-Path $sidablist)) {
    Write-Warning "SIDablist repo not found at $sidablist - skipping link/build check."
    exit 0
}
$sidablist = (Resolve-Path $sidablist).Path

$libs = @('analysis', 'tunes')

$distMissing = $libs | Where-Object { -not (Test-Path (Join-Path $sidablist "libs\$_\dist")) }
if ($distMissing) {
    Write-Host "SIDablist libs missing a build: $($distMissing -join ', '). Installing and building..."
    pnpm -C $sidablist install
    pnpm -C $sidablist --filter @sidablist/analysis --filter @sidablist/tunes run build
}

$linksMissing = $libs | Where-Object { -not (Test-Path (Join-Path $root "node_modules\@sidablist\$_")) }
if ($linksMissing) {
    Write-Host "Frontend node_modules missing links: $($linksMissing -join ', '). Running pnpm install..."
    pnpm -C $root install
}
