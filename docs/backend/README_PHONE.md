# Backend for physical Android phone

The phone cannot use `localhost`. It must use your PC's Wi‑Fi IP (e.g. `http://10.10.x.x:5000`).

## Start server (required)

```powershell
cd fastapi_back
.\start.ps1
```

Or:

```powershell
python -m uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

**Wrong** (phone will timeout):

```powershell
python -m uvicorn main:app --port 5000 --reload
```

That binds only `127.0.0.1`. Chrome on the PC still works; the phone will not connect.

## Check

- `ipconfig` → Wi‑Fi **IPv4** must match `flutter_mobile/assets/config.env` → `API_BASE_URL`
- Phone and PC on the **same Wi‑Fi**
- Windows Firewall: allow **Python** on private networks for port **5000**

When login works from the phone, uvicorn logs show your PC LAN IP (not only `127.0.0.1`).
