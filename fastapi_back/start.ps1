# LAN-accessible FastAPI (required for Expo on a physical phone)
Set-Location $PSScriptRoot
python -m uvicorn main:app --host 0.0.0.0 --port 5000 --reload
