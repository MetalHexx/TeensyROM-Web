#!/usr/bin/env pwsh
# copy-frontend.ps1 - Build Angular frontend and copy to API wwwroot
#
# This script builds the Angular application in production mode and copies
# the output to the API's wwwroot folder for static file serving.
#
# Usage: .\scripts\copy-frontend.ps1
# Or via npm: pnpm run build:frontend

$ErrorActionPreference = "Stop"

# Resolve paths relative to script location
$repoRoot = $PSScriptRoot | Split-Path -Parent
$distPath = Join-Path $repoRoot "dist/apps/teensyrom-ui/browser"
$wwwrootPath = Join-Path $repoRoot "apps/api/src/TeensyRom.Api/wwwroot"

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  TeensyROM Frontend Build & Copy" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build Angular frontend
Write-Host "📦 Building Angular frontend (production)..." -ForegroundColor Cyan
Write-Host "   Command: pnpm nx build teensyrom-ui --configuration=production" -ForegroundColor Gray
Write-Host ""

Push-Location $repoRoot
try {
    $buildOutput = pnpm nx build teensyrom-ui --configuration=production 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed!" -ForegroundColor Red
        Write-Host $buildOutput
        exit 1
    }
    Write-Host "✅ Build completed successfully" -ForegroundColor Green
} finally {
    Pop-Location
}

# Step 2: Verify dist folder exists
Write-Host ""
Write-Host "🔍 Verifying build output..." -ForegroundColor Cyan
if (-not (Test-Path $distPath)) {
    Write-Host "❌ Build output not found at: $distPath" -ForegroundColor Red
    exit 1
}
$fileCount = (Get-ChildItem -Path $distPath -Recurse -File).Count
Write-Host "   Found $fileCount files in build output" -ForegroundColor Gray

# Step 3: Clean wwwroot (preserve .gitkeep)
Write-Host ""
Write-Host "🧹 Cleaning wwwroot folder..." -ForegroundColor Cyan
if (Test-Path $wwwrootPath) {
    Get-ChildItem -Path $wwwrootPath -Exclude ".gitkeep" | Remove-Item -Recurse -Force
    Write-Host "   Cleaned existing files (preserved .gitkeep)" -ForegroundColor Gray
} else {
    Write-Host "❌ wwwroot folder not found at: $wwwrootPath" -ForegroundColor Red
    exit 1
}

# Step 4: Copy files to wwwroot
Write-Host ""
Write-Host "📋 Copying files to wwwroot..." -ForegroundColor Cyan
try {
    Copy-Item -Path "$distPath\*" -Destination $wwwrootPath -Recurse -Force
    $copiedCount = (Get-ChildItem -Path $wwwrootPath -Recurse -File -Exclude ".gitkeep").Count
    Write-Host "   Copied $copiedCount files to wwwroot" -ForegroundColor Gray
} catch {
    Write-Host "❌ Copy failed: $_" -ForegroundColor Red
    exit 1
}

# Step 5: Success summary
Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ SUCCESS" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend build copied to:" -ForegroundColor White
Write-Host "  $wwwrootPath" -ForegroundColor Gray
Write-Host ""
Write-Host "To test, run the API:" -ForegroundColor White
Write-Host "  cd apps/api/src/TeensyRom.Api" -ForegroundColor Gray
Write-Host "  dotnet run" -ForegroundColor Gray
Write-Host "  Navigate to: http://localhost:5168" -ForegroundColor Gray
Write-Host ""
