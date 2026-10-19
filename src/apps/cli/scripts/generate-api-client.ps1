#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Regenerates the CLI's API client from the engine's OpenAPI spec.

.DESCRIPTION
    Usage:  pwsh apps/cli/scripts/generate-api-client.ps1        (or: pnpm run generate:cli-api-client, from src/)

    Builds the engine (apps/api/src/TeensyRom.Api), which rewrites its spec at
    apps/api/src/TeensyRom.Api/api-spec/TeensyRom.Api.json, then restores the pinned NSwag tool and runs it on
    apps/cli/src/TeensyRom.Cli/Api/nswag.json, which rewrites Api/Generated/TeensyRomApiClient.g.cs.
    Needs the .NET SDK only - no Java or Node. Every path comes from this script's location, so it runs from any
    working directory.

    On Windows, an engine running from its bin/Debug folder locks the files the build writes: stop it first
    (pwsh apps/cli/scripts/test-api.ps1 stop).

    Exit code 0 on success. On failure: exit 1 with a single "generate-api-client: <reason>" line on stderr.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$CliRoot = Split-Path $PSScriptRoot -Parent
$AppsRoot = Split-Path $CliRoot -Parent
$EngineProject = Join-Path $AppsRoot 'api/src/TeensyRom.Api/TeensyRom.Api.csproj'
$NswagConfig = 'src/TeensyRom.Cli/Api/nswag.json'

function Fail([string]$Message) {
    [Console]::Error.WriteLine("generate-api-client: $Message")
    exit 1
}

try {
    if (-not (Test-Path -LiteralPath $EngineProject)) { Fail "engine project not found: $EngineProject" }

    Write-Host 'generate-api-client: building the engine to refresh its spec...'
    & dotnet build $EngineProject --nologo -v:minimal
    if ($LASTEXITCODE -ne 0) {
        Fail "engine build failed (exit $LASTEXITCODE) - if an engine is running from bin/Debug it locks its files; stop it with 'pwsh $(Join-Path $PSScriptRoot 'test-api.ps1') stop' and run this again"
    }

    Push-Location $CliRoot
    try {
        & dotnet tool restore --verbosity quiet
        if ($LASTEXITCODE -ne 0) { Fail "dotnet tool restore failed (exit $LASTEXITCODE)" }

        & dotnet nswag run $NswagConfig
        if ($LASTEXITCODE -ne 0) { Fail "nswag run failed (exit $LASTEXITCODE)" }
    }
    finally { Pop-Location }

    Write-Host 'generate-api-client: Api/Generated/TeensyRomApiClient.g.cs regenerated'
}
catch {
    Fail ($_.Exception.Message -replace '\s*[\r\n]+\s*', ' ')
}
