"""Partner auth middleware — FastAPI dependency for partner API key + HMAC validation.

Usage in routes:
    from app.middleware.partner_auth import partner_auth, require_partner_apis
    @router.post("/orders/{id}/status")
    async def update(..., partner=Depends(require_partner_apis("pharmacy.orders.write"))):
        partner["partner_id"]
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import time
from typing import Any, Optional

from fastapi import Depends, Header, HTTPException, Request

from app.models import partner_model
from app.services import partner_auth_service
from app.utils.app_logger import get_logger

log = get_logger(__name__)

# Simple in-memory rate limiter (fallback when Redis unavailable)
_rate_buckets: dict[str, list[float]] = {}
_partner_redis = None


def _check_rate_limit(partner_id: int, limit_rpm: int) -> bool:
    """Sliding window rate limiter. Returns True when within limit."""
    global _partner_redis
    key = f"partner_rl:{partner_id}"
    now = time.time()
    window_start = now - 60.0

    try:
        from app.config.config import settings
        url = (getattr(settings, "REDIS_URL", None) or "").strip()
        if url:
            import redis

            if _partner_redis is None:
                _partner_redis = redis.from_url(url, decode_responses=True, protocol=2)
            r = _partner_redis
            pipe = r.pipeline()
            pipe.zremrangebyscore(key, 0, window_start)
            pipe.zcard(key)
            pipe.zadd(key, {str(now): now})
            pipe.expire(key, 61)
            results = pipe.execute()
            count = int(results[1] or 0)
            return count < limit_rpm
    except Exception:
        pass

    bucket = _rate_buckets.get(key, [])
    bucket = [t for t in bucket if t > window_start]
    if len(bucket) >= limit_rpm:
        _rate_buckets[key] = bucket
        return False
    bucket.append(now)
    _rate_buckets[key] = bucket
    return True


def _parse_json_list(raw: Any) -> list:
    if raw is None:
        return []
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _path_matches_scope(path: str, allowed: list[str]) -> bool:
    """Check whether the request path is permitted by allowed_apis scopes.

    Scopes use dotted names mapped to path prefixes, e.g.:
      emergency.* → /api/partner/emergency
      pharmacy.*  → /api/v1/partner/pharmacy
      lab.*       → /api/v1/partner/lab
    Empty allowed list = deny all (must be configured explicitly).
    Wildcard '*' = allow all.
    """
    if not allowed:
        return False
    if "*" in allowed or "all" in allowed:
        return True

    path = path.rstrip("/")
    normalized = [str(s).strip().lower() for s in allowed if s]

    try:
        from app.services.partner_domain_registry import build_scope_prefix_map
        prefix_map = build_scope_prefix_map()
    except Exception:
        prefix_map = {
            "emergency": "/api/partner/emergency",
            "emergency.*": "/api/partner/emergency",
            "pharmacy": "/api/v1/partner/pharmacy",
            "pharmacy.*": "/api/v1/partner/pharmacy",
            "dashboard": "/api/partner/dashboard",
            "dashboard.*": "/api/partner/dashboard",
        }

    for scope in normalized:
        mapped = prefix_map.get(scope)
        if mapped and path.startswith(mapped.rstrip("/")):
            return True
        # Also allow raw path prefixes stored as scopes
        if scope.startswith("/") and path.startswith(scope.rstrip("/")):
            return True
        # Generic: "lab.orders.write" → try parent "lab.*" / "lab"
        parts = scope.split(".")
        while len(parts) > 1:
            parts = parts[:-1]
            parent = ".".join(parts) + ".*"
            mapped = prefix_map.get(parent) or prefix_map.get(parts[0])
            if mapped and path.startswith(mapped.rstrip("/")):
                return True
    return False


async def partner_auth(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-Api-Key"),
    x_timestamp: Optional[str] = Header(None, alias="X-Timestamp"),
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
) -> dict[str, Any]:
    """Validate partner API key + HMAC signature; enforce IP, rate limit, scopes."""
    from app.config.db import db

    started = time.perf_counter()

    # 0. Super Admin bypass for analytics dashboard (aToken)
    a_token = request.headers.get("aToken") or request.headers.get("atoken")
    if a_token:
        try:
            from app.config.config import settings
            from jose import jwt
            secret = settings.JWT_SECRET.strip('"').strip("'")
            payload = jwt.decode(a_token, secret, algorithms=["HS256"])
            email = payload.get("email")
            expected_admin = getattr(settings, "ADMIN_EMAIL", None)
            if email and str(email).strip().lower() == str(expected_admin).strip().lower():
                partner_id_str = request.query_params.get("partner_id") or request.headers.get("X-Partner-Id")
                partner_id = int(partner_id_str) if partner_id_str else 1
                partner_name = "Admin Override"
                webhook_url = None
                try:
                    p_row = await db.fetch_row(
                        "SELECT name, webhook_url FROM partners WHERE id = $1", partner_id
                    )
                    if p_row:
                        partner_name = p_row["name"]
                        webhook_url = p_row["webhook_url"]
                except Exception:
                    pass
                result = {
                    "partner_id": partner_id,
                    "partner_name": partner_name,
                    "api_key": "admin_view",
                    "environment": "sandbox",
                    "is_sandbox": True,
                    "webhook_url": webhook_url,
                    "allowed_apis": ["*"],
                    "is_admin_bypass": True,
                }
                request.state.partner = result
                return result
        except Exception as e:
            log.warning("Partner auth: admin bypass attempt failed: %s", str(e))

    if not x_api_key:
        raise HTTPException(status_code=401, detail="X-Api-Key header missing")

    key_row = await partner_model.get_active_key(x_api_key)
    if not key_row:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key")

    if key_row["partner_status"] != "active":
        raise HTTPException(
            status_code=403,
            detail=f"Partner account is '{key_row['partner_status']}'. Contact MEDCLUES support.",
        )

    # IP whitelist
    ip_whitelist = _parse_json_list(key_row.get("ip_whitelist"))
    client_ip = _client_ip(request)
    if ip_whitelist and client_ip not in ip_whitelist:
        log.warning(
            "Partner auth: IP %s not in whitelist for partner %s",
            client_ip, key_row["partner_id"],
        )
        raise HTTPException(status_code=403, detail="IP address not whitelisted")

    # Rate limit
    if not _check_rate_limit(key_row["partner_id"], key_row["rate_limit_rpm"]):
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded ({key_row['rate_limit_rpm']} req/min)",
            headers={"Retry-After": "60"},
        )

    is_sandbox = key_row.get("environment", "sandbox") == "sandbox"
    sandbox_bypass = request.headers.get("X-Sandbox-Bypass", "").lower() == "true"

    # HMAC — required for production; sandbox may bypass only with explicit header
    body = await request.body()
    raw_secret = partner_auth_service.decrypt_secret(key_row.get("secret_encrypted") or "")

    if not (is_sandbox and sandbox_bypass):
        if not x_timestamp or not x_signature:
            raise HTTPException(
                status_code=401,
                detail="X-Timestamp and X-Signature headers required",
            )
        if not raw_secret:
            log.error(
                "Partner auth: no decryptable secret for key partner=%s — re-issue key",
                key_row["partner_id"],
            )
            raise HTTPException(
                status_code=401,
                detail="API key cannot verify signatures. Contact MEDCLUES to rotate credentials.",
            )
        path = request.url.path
        ok = partner_auth_service.verify_request_signature(
            raw_secret, x_timestamp, request.method, path, body, x_signature,
        )
        if not ok:
            raise HTTPException(status_code=401, detail="Invalid request signature")

    # allowed_apis / scopes
    allowed_apis = _parse_json_list(key_row.get("allowed_apis"))
    # Empty scopes: sandbox may warn+allow (legacy); production must have scopes configured.
    if not allowed_apis:
        if is_sandbox:
            log.warning(
                "Partner auth: empty allowed_apis for sandbox partner %s — allowing (configure scopes)",
                key_row["partner_id"],
            )
        else:
            raise HTTPException(
                status_code=403,
                detail="Production partner must have allowed_apis scopes configured.",
            )
    elif not _path_matches_scope(request.url.path, allowed_apis):
        raise HTTPException(
            status_code=403,
            detail="API scope not permitted for this partner. Contact MEDCLUES Super Admin.",
        )

    asyncio.create_task(partner_model.update_key_last_used(x_api_key))

    result = {
        "partner_id": key_row["partner_id"],
        "partner_name": key_row["partner_name"],
        "api_key": x_api_key,
        "environment": key_row["environment"],
        "is_sandbox": is_sandbox,
        "webhook_url": key_row.get("webhook_url"),
        "allowed_apis": allowed_apis,
        "is_admin_bypass": False,
        "_auth_started": started,
        "_client_ip": client_ip,
    }
    request.state.partner = result

    # Fire-and-forget request log (response code filled as 0 here; routes may update)
    asyncio.create_task(
        partner_model.write_api_log(
            partner_id=key_row["partner_id"],
            endpoint=request.url.path,
            method=request.method,
            request_hash=hashlib.sha256(body).hexdigest() if body else None,
            response_code=None,
            latency_ms=int((time.perf_counter() - started) * 1000),
            error=None,
            ip_address=client_ip,
        )
    )
    return result


def require_partner_apis(*required_scopes: str):
    """Dependency factory: partner_auth + extra explicit scope checks."""

    async def _dep(partner: dict = Depends(partner_auth)) -> dict:
        if partner.get("is_admin_bypass"):
            return partner
        allowed = [str(s).lower() for s in (partner.get("allowed_apis") or [])]
        if "*" in allowed or "all" in allowed:
            return partner
        for scope in required_scopes:
            s = scope.lower()
            if s in allowed:
                return partner
            # prefix wildcards: pharmacy.* covers pharmacy.orders.write
            parts = s.split(".")
            while parts:
                wildcard = ".".join(parts[:-1] + ["*"]) if len(parts) > 1 else parts[0] + ".*"
                if wildcard in allowed or parts[0] in allowed or f"{parts[0]}.*" in allowed:
                    return partner
                parts = parts[:-1]
        raise HTTPException(status_code=403, detail=f"Missing required scope: {', '.join(required_scopes)}")
    return _dep
