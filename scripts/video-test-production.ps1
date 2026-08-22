# Align doctor admin + patient APK to production Render API.
# Run from repo root: .\scripts\video-test-production.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$render = "https://medclues.onrender.com"

$adminEnv = @"
VITE_BACKEND_URL=$render
VITE_CURRENCY=INR
VITE_ENABLE_SOCKET=false
"@
Set-Content -Path (Join-Path $root "admin\.env") -Value $adminEnv.TrimEnd() -Encoding UTF8

$flutterConfig = Join-Path $root "flutter_mobile\assets\config.env"
$lines = @(
  "# Production API (Android APK / release builds)",
  "API_BASE_URL=$render",
  "API_BASE_URL_WEB=http://localhost:5000",
  "TELEGRAM_BOT_USERNAME=medcluesBot"
)
Set-Content -Path $flutterConfig -Value ($lines -join "`n") -Encoding UTF8

Write-Host ""
Write-Host "Video test - PRODUCTION mode" -ForegroundColor Cyan
Write-Host "  Doctor admin -> $render"
Write-Host "  Patient APK  -> $render"
Write-Host ""
Write-Host "1. Ensure Render deployed latest main + AGORA_* env vars set"
Write-Host "2. Restart admin: cd admin; npm run dev"
Write-Host "3. Rebuild APK: cd flutter_mobile; flutter build apk --release"
Write-Host ""
