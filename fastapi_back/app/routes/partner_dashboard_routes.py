"""Partner dashboard routes — analytics, logs, billing, webhook debugging.

Base path: /api/partner/dashboard
Auth: partner_auth dependency (same X-Api-Key header flow)

Endpoints:
    GET /summary         → KPI summary (total cases, success rate, etc.)
    GET /cases           → paginated case history with filters
    GET /webhooks        → list webhook delivery status
    POST /webhooks/{id}/retry → manually retry a single failed delivery
    GET /api-logs        → recent API request logs
    GET /billing         → usage summary for current billing period
    GET /tracking/{token} → public tracking endpoint (no auth)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import Optional

from app.config.db import db
from app.middleware.partner_auth import partner_auth
from app.models import emergency_case_model as ecm
from app.utils.app_logger import get_logger

log = get_logger(__name__)

router = APIRouter(prefix="/api/partner/dashboard", tags=["Partner Dashboard — Phase 3"])

# ── KPI Summary ───────────────────────────────────────────────────────────────

@router.get("/summary", summary="Partner: KPI summary for dashboard")
async def get_summary(partner: dict = Depends(partner_auth)):
    partner_id = partner["partner_id"]

    rows = await db.query(
        """
        SELECT
            COUNT(*)                                              AS total_cases,
            COUNT(*) FILTER (WHERE status = 'COMPLETED')         AS completed,
            COUNT(*) FILTER (WHERE status = 'CANCELLED')         AS cancelled,
            COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED','CANCELLED')) AS active,
            AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60.0)
                FILTER (WHERE completed_at IS NOT NULL)          AS avg_resolution_minutes,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS last_30_days,
            COUNT(*) FILTER (WHERE is_sandbox = true)            AS sandbox_cases
        FROM emergency_cases
        WHERE partner_id = $1
        """,
        partner_id,
    )
    row = dict(rows[0]) if rows else {}

    webhook_rows = await db.query(
        """
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
            COUNT(*) FILTER (WHERE status IN ('failed','permanently_failed')) AS failed,
            COUNT(*) FILTER (WHERE status = 'pending') AS pending
        FROM webhook_deliveries WHERE partner_id = $1
        """,
        partner_id,
    )
    wh = dict(webhook_rows[0]) if webhook_rows else {}

    return {
        "success": True,
        "data": {
            "cases": {
                "total":                  int(row.get("total_cases") or 0),
                "completed":              int(row.get("completed") or 0),
                "cancelled":              int(row.get("cancelled") or 0),
                "active":                 int(row.get("active") or 0),
                "last_30_days":           int(row.get("last_30_days") or 0),
                "sandbox":                int(row.get("sandbox_cases") or 0),
                "avg_resolution_minutes": round(float(row.get("avg_resolution_minutes") or 0), 1),
                "success_rate_pct": round(
                    int(row.get("completed") or 0) / max(int(row.get("total_cases") or 1), 1) * 100, 1
                ),
            },
            "webhooks": {
                "total":     int(wh.get("total") or 0),
                "delivered": int(wh.get("delivered") or 0),
                "failed":    int(wh.get("failed") or 0),
                "pending":   int(wh.get("pending") or 0),
            },
        },
    }


# ── Case history (filterable) ─────────────────────────────────────────────────

@router.get("/cases", summary="Partner: case history with filters")
async def get_case_history(
    partner: dict = Depends(partner_auth),
    status: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    sandbox: Optional[bool] = None,
):
    conditions = ["partner_id = $1"]
    params: list = [partner["partner_id"]]
    idx = 2

    if status:
        conditions.append(f"status = ${idx}")
        params.append(status)
        idx += 1
    if sandbox is not None:
        conditions.append(f"is_sandbox = ${idx}")
        params.append(sandbox)
        idx += 1

    where = " AND ".join(conditions)
    params += [limit, offset]

    rows = await db.query(
        f"""
        SELECT * FROM emergency_cases
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT ${idx} OFFSET ${idx+1}
        """,
        *params,
    )
    from app.controllers.dispatch_controller import _format_case_response
    return {
        "success": True,
        "data": [_format_case_response(dict(r)) for r in rows],
        "pagination": {"limit": limit, "offset": offset, "count": len(rows)},
    }


# ── Webhook deliveries ────────────────────────────────────────────────────────

@router.get("/webhooks", summary="Partner: list webhook deliveries")
async def list_webhooks(
    partner: dict = Depends(partner_auth),
    status: Optional[str] = None,
    event_prefix: Optional[str] = Query(default=None, description="Filter e.g. pharmacy=order.,prescription.,payment.,availability."),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    conditions = ["partner_id = $1"]
    params: list = [partner["partner_id"]]
    idx = 2
    if status:
        conditions.append(f"status = ${idx}")
        params.append(status)
        idx += 1
    if event_prefix == "pharmacy":
        conditions.append(
            f"(event_type LIKE ${idx} OR event_type LIKE ${idx+1} OR event_type LIKE ${idx+2} OR event_type LIKE ${idx+3})"
        )
        params.extend(["order.%", "prescription.%", "payment.%", "availability.%"])
        idx += 4
    elif event_prefix:
        conditions.append(f"event_type LIKE ${idx}")
        params.append(f"{event_prefix}%")
        idx += 1
    params += [limit, offset]
    rows = await db.query(
        f"""
        SELECT id, delivery_id, event_type, status, attempts,
               last_attempt_at, next_retry_at, response_code, created_at
        FROM webhook_deliveries
        WHERE {" AND ".join(conditions)}
        ORDER BY created_at DESC
        LIMIT ${idx} OFFSET ${idx+1}
        """,
        *params,
    )
    return {"success": True, "data": [dict(r) for r in rows]}


@router.get("/pharmacy-orders", summary="Partner/admin: recent pharmacy orders + sync hint")
async def list_pharmacy_orders(
    partner: dict = Depends(partner_auth),
    limit: int = Query(default=50, ge=1, le=100),
):
    from app.services import pharmacy_service
    return await pharmacy_service.admin_list_pharmacy_orders(
        int(partner["partner_id"]),
        limit=limit,
    )


@router.post("/webhooks/{delivery_id}/retry", summary="Partner: manually retry a webhook delivery")
async def retry_webhook(delivery_id: int, partner: dict = Depends(partner_auth)):
    row = await db.fetch_row(
        "SELECT * FROM webhook_deliveries WHERE id=$1 AND partner_id=$2",
        delivery_id, partner["partner_id"],
    )
    if not row:
        raise HTTPException(status_code=404, detail="Delivery not found")
    # Reset retry time to now
    await db.execute(
        "UPDATE webhook_deliveries SET status='failed', next_retry_at=NOW() WHERE id=$1",
        delivery_id,
    )
    return {"success": True, "message": "Retry scheduled. Worker will pick it up within 60s."}


# ── API logs ──────────────────────────────────────────────────────────────────

@router.get("/api-logs", summary="Partner: recent API request logs")
async def get_api_logs(
    partner: dict = Depends(partner_auth),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    rows = await db.query(
        """
        SELECT endpoint, method, response_code, latency_ms, error, ip_address, created_at
        FROM partner_api_logs
        WHERE partner_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """,
        partner["partner_id"], limit, offset,
    )
    return {"success": True, "data": [dict(r) for r in rows]}


# ── Billing summary ───────────────────────────────────────────────────────────

@router.get("/billing", summary="Partner: current billing period usage")
async def get_billing(partner: dict = Depends(partner_auth)):
    rows = await db.query(
        """
        SELECT
            DATE_TRUNC('month', created_at) AS month,
            COUNT(*) AS api_calls,
            COUNT(*) FILTER (WHERE response_code < 300) AS successful_calls,
            AVG(latency_ms) AS avg_latency_ms
        FROM partner_api_logs
        WHERE partner_id = $1
          AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY 1
        ORDER BY 1 DESC
        """,
        partner["partner_id"],
    )
    return {"success": True, "data": [dict(r) for r in rows]}


# ── Public tracking endpoint (no auth — token-based) ─────────────────────────

public_router = APIRouter(prefix="/api/partner/emergency", tags=["Public Tracking"])


@public_router.get("/track/{tracking_token}", summary="Public: live tracking by token")
async def track_by_token(tracking_token: str, request: Request):
    row = await db.fetch_row(
        """
        SELECT ec.*, p.name AS partner_name
        FROM emergency_cases ec
        JOIN partners p ON p.id = ec.partner_id
        WHERE ec.tracking_token = $1
        """,
        tracking_token,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Tracking token not found or expired")
    case = dict(row)

    # If this is a browser request, redirect to the live GreenCorridorPage map UI
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        from app.config.config import settings as _settings
        from fastapi.responses import RedirectResponse
        admin_base = (_settings.ADMIN_PANEL_URL or "https://medclues-admin.vercel.app").rstrip("/")
        redirect_url = f"{admin_base}/live-track/{case['public_id']}"
        return RedirectResponse(url=redirect_url, status_code=302)

    # API clients: return JSON as before
    from app.controllers.dispatch_controller import _format_case_response
    result = _format_case_response(case)
    # Add extra fields for public display
    result["public_id"] = case["public_id"]
    result["latitude"] = case["latitude"]
    result["longitude"] = case["longitude"]
    return {"success": True, "data": result}

