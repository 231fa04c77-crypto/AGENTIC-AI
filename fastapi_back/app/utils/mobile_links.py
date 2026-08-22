"""Deep links and navigation URLs for MEDCLUES mobile app (email, Telegram, SMS)."""
from __future__ import annotations

from html import escape
from typing import Optional
from urllib.parse import quote, urlencode

from app.config.config import settings

# Must match flutter_mobile android applicationId until the package-rename sprint.
# Override via MEDCLUES_ANDROID_PACKAGE when the Play Store id changes.
ANDROID_PACKAGE = (
    (getattr(settings, "MEDCLUES_ANDROID_PACKAGE", None) or "").strip()
    or "com.medichain.medichain_mobile"
)


def _scheme() -> str:
    return (settings.MEDCLUES_APP_DEEP_LINK_SCHEME or "medclues").strip().rstrip(":/")


def deep_link_schemes() -> list[str]:
    """Primary scheme first, then configured aliases (for docs / multi-redirect)."""
    primary = _scheme()
    aliases = [
        s.strip().rstrip(":/")
        for s in str(getattr(settings, "MEDCLUES_APP_DEEP_LINK_ALIASES", "") or "").split(",")
        if s.strip()
    ]
    out: list[str] = []
    for s in [primary, *aliases]:
        if s and s not in out:
            out.append(s)
    return out or ["medclues"]


def public_base_url() -> str:
    return (settings.BACKEND_URL or settings.FRONTEND_URL or "https://medclues.onrender.com").rstrip("/")


def appointment_deep_link(appointment_id: int | str) -> str:
    return f"{_scheme()}://open/appointments/{appointment_id}"


def appointment_android_intent_link(appointment_id: int | str) -> str:
    path = f"open/appointments/{appointment_id}"
    return (
        f"intent://{path}#Intent;"
        f"scheme={_scheme()};"
        f"package={ANDROID_PACKAGE};"
        f"end"
    )


def appointment_email_link(appointment_id: int | str) -> str:
    """HTTPS bridge page — opens the native app to a specific appointment."""
    return f"{public_base_url()}/link/appointment/{appointment_id}"


def maps_geo_url(
    hospital_name: str,
    full_address: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
) -> str:
    """geo: URI — on Android shows Maps / Uber / Rapido / Ola chooser."""
    label = quote((hospital_name or "Hospital").strip())
    if lat is not None and lng is not None:
        try:
            lat_f, lng_f = float(lat), float(lng)
            if lat_f != 0.0 or lng_f != 0.0:
                return f"geo:{lat_f},{lng_f}?q={lat_f},{lng_f}({label})"
        except (TypeError, ValueError):
            pass
    query = quote(f"{hospital_name}, {full_address}".strip(", "))
    return f"geo:0,0?q={query}"


def maps_email_link(
    hospital_name: str,
    full_address: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
) -> str:
    """HTTPS bridge page — redirects to geo: for navigation app chooser."""
    params: dict[str, str] = {"q": f"{hospital_name}, {full_address}".strip(", ")}
    if lat is not None and lng is not None:
        try:
            lat_f, lng_f = float(lat), float(lng)
            if lat_f != 0.0 or lng_f != 0.0:
                params["lat"] = str(lat_f)
                params["lng"] = str(lng_f)
        except (TypeError, ValueError):
            pass
    return f"{public_base_url()}/link/maps?{urlencode(params)}"


def appointment_open_html(appointment_id: int | str) -> str:
    deep = escape(appointment_deep_link(appointment_id), quote=True)
    intent = escape(appointment_android_intent_link(appointment_id), quote=True)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Open MEDCLUES</title>
  <script>
    function openApp() {{
      window.location.href = "{intent}";
      setTimeout(function() {{ window.location.href = "{deep}"; }}, 600);
    }}
    window.onload = openApp;
  </script>
</head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F5F9FC;">
  <div style="max-width:420px;margin:48px auto;padding:32px 24px;text-align:center;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);">
    <h2 style="margin:0 0 8px;color:#002855;">Opening appointment…</h2>
    <p style="margin:0 0 24px;color:#64748B;font-size:14px;">Tap below if the MEDCLUES app does not open automatically.</p>
    <a href="{intent}" style="display:inline-block;padding:14px 32px;background:#009F93;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">Open in MEDCLUES App</a>
  </div>
</body>
</html>"""


def maps_open_html(
    hospital_name: str,
    full_address: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
) -> str:
    geo = escape(maps_geo_url(hospital_name, full_address, lat, lng), quote=True)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Directions</title>
  <meta http-equiv="refresh" content="0;url={geo}">
</head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F5F9FC;">
  <div style="max-width:420px;margin:48px auto;padding:32px 24px;text-align:center;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);">
    <h2 style="margin:0 0 8px;color:#002855;">Get directions</h2>
    <p style="margin:0 0 24px;color:#64748B;font-size:14px;">Choose Google Maps, Uber, Rapido, or another maps app.</p>
    <a href="{geo}" style="display:inline-block;padding:14px 32px;background:#1565C0;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">Open in Maps</a>
  </div>
</body>
</html>"""
