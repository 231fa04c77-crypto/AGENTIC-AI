"""Public HTTPS bridges for email/SMS links → native app & maps."""
from __future__ import annotations

import html
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["links"])


@router.get("/link/appointment/{appointment_id}")
async def link_open_appointment(appointment_id: int):
    from app.utils.mobile_links import appointment_open_html

    return HTMLResponse(appointment_open_html(appointment_id))


@router.get("/link/appointment-summary/{booking_id}")
async def link_appointment_summary(
    booking_id: str,
    sig: str | None = Query(None),
):
    """Phone-camera landing page for Visit Summary QR (safe fields only)."""
    from app.services import appointment_summary_service

    result = await appointment_summary_service.get_public_appointment_summary(booking_id, sig)
    if not result.get("success"):
        msg = html.escape(str(result.get("message") or "Unable to load appointment"))
        return HTMLResponse(
            f"""<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MedClues Visit</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;background:#0f172a;color:#e2e8f0">
<h1 style="font-size:1.25rem">Visit summary unavailable</h1>
<p>{msg}</p></body></html>""",
            status_code=400,
        )

    a = result.get("appointment") or {}
    rows = [
        ("Booking ID", a.get("bookingId")),
        ("Public ID", a.get("publicId")),
        ("Patient", a.get("patientName")),
        ("Doctor", a.get("doctorName")),
        ("Specialty", a.get("specialization")),
        ("Hospital", a.get("hospitalName")),
        ("Date", a.get("slotDate")),
        ("Time", a.get("slotTime")),
        ("Token", a.get("tokenNumber")),
        ("Status", a.get("lifecycleStatus") or a.get("status")),
        ("Completed", a.get("completedAt")),
        ("Prescription ready", "Yes" if a.get("prescriptionReady") else "No"),
    ]
    items = "".join(
        f"<tr><th style='text-align:left;padding:8px 12px 8px 0;color:#94a3b8;font-weight:600'>"
        f"{html.escape(str(label))}</th>"
        f"<td style='padding:8px 0'>{html.escape(str(value) if value is not None else '—')}</td></tr>"
        for label, value in rows
        if value is not None and str(value).strip() != ""
    )
    return HTMLResponse(
        f"""<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MedClues Visit Summary</title></head>
<body style="font-family:system-ui,sans-serif;margin:0;background:#0f172a;color:#f8fafc">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
<p style="letter-spacing:.12em;text-transform:uppercase;color:#38bdf8;font-size:.75rem;font-weight:700;margin:0 0 8px">MedClues</p>
<h1 style="font-size:1.5rem;margin:0 0 6px">Visit summary</h1>
<p style="color:#94a3b8;margin:0 0 20px">Scanned from your appointment QR</p>
<table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:16px;padding:8px;display:block">
{items}
</table>
</div></body></html>"""
    )


@router.get("/link/maps")
async def link_open_maps(
    q: str = Query("", description="Hospital name and address"),
    lat: Optional[float] = None,
    lng: Optional[float] = None,
):
    from app.utils.mobile_links import maps_open_html

    parts = [p.strip() for p in q.split(",", 1)] if q else []
    hospital_name = parts[0] if parts else "Hospital"
    full_address = parts[1] if len(parts) > 1 else (q or hospital_name)
    return HTMLResponse(maps_open_html(hospital_name, full_address, lat, lng))
