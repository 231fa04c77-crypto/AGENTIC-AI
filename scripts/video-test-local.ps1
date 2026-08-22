# Align doctor admin + patient APK to the SAME local FastAPI (port 5000).
# Run from repo root: .\scripts\video-test-local.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169\.' } |
  Select-Object -First 1).IPAddress

if (-not $ip) {
  Write-Error "Could not detect LAN IP. Set API_BASE_URL manually."
}

$adminEnv = @"
VITE_BACKEND_URL=http://localhost:5000
VITE_CURRENCY=INR
VITE_ENABLE_SOCKET=false
"@
Set-Content -Path (Join-Path $root "admin\.env") -Value $adminEnv.TrimEnd() -Encoding UTF8

$flutterConfig = Join-Path $root "flutter_mobile\assets\config.env"
$lines = Get-Content $flutterConfig -ErrorAction SilentlyContinue
if (-not $lines) {
  $lines = @(
    "# Local video test - phone reaches PC via Wi-Fi",
    "API_BASE_URL=http://${ip}:5000",
    "API_BASE_URL_WEB=http://localhost:5000",
    "TELEGRAM_BOT_USERNAME=medcluesBot"
  )
} else {
  $lines = $lines | ForEach-Object {
    if ($_ -match '^API_BASE_URL=') { "API_BASE_URL=http://${ip}:5000" } else { $_ }
  }
}
Set-Content -Path $flutterConfig -Value ($lines -join "`n") -Encoding UTF8

Write-Host ""
Write-Host "Video test - LOCAL mode" -ForegroundColor Cyan
Write-Host "  Doctor admin -> http://localhost:5000"
Write-Host "  Patient APK  -> http://${ip}:5000"
Write-Host ""
Write-Host "1. Backend:  cd fastapi_back; python -m uvicorn main:app --host 0.0.0.0 --port 5000 --reload"
Write-Host "2. Admin:    cd admin; npm run dev  (restart if already running)"
Write-Host "3. APK:      cd flutter_mobile; flutter build apk --release"
Write-Host "4. Phone and PC must be on the same Wi-Fi."
Write-Host ""
