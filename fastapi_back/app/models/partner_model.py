"""Partner model — CRUD queries for partners and API keys."""
from __future__ import annotations

import json
from typing import Any, Optional

from app.config.db import db


# ── Partners ─────────────────────────────────────────────────────────────────

async def get_all_partners(include_deleted: bool = False) -> list:
    sql = """
        SELECT p.*, COUNT(ak.id) AS key_count
        FROM partners p
        LEFT JOIN partner_api_keys ak ON ak.partner_id = p.id AND ak.revoked_at IS NULL
        {}
        GROUP BY p.id
        ORDER BY p.created_at DESC
    """.format("" if include_deleted else "WHERE p.deleted_at IS NULL")
    return await db.query(sql)


async def get_partner_by_id(partner_id: int) -> Optional[dict]:
    row = await db.fetch_row(
        "SELECT * FROM partners WHERE id = $1 AND deleted_at IS NULL",
        partner_id,
    )
    return dict(row) if row else None


async def create_partner(data: dict) -> dict:
    row = await db.fetch_row(
        """
        INSERT INTO partners (
            public_id, name, partner_type, contact_name, email, phone,
            webhook_url, allowed_domains, allowed_apis, status,
            rate_limit_rpm, ip_whitelist, billing_plan,
            webhook_signing_secret_encrypted
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12::jsonb,$13,$14)
        RETURNING *
        """,
        data["public_id"],
        data["name"],
        data["partner_type"],
        data.get("contact_name"),
        data.get("email"),
        data.get("phone"),
        data.get("webhook_url"),
        json.dumps(data.get("allowed_domains", [])),
        json.dumps(data.get("allowed_apis", [])),
        data.get("status", "pending"),
        data.get("rate_limit_rpm", 60),
        json.dumps(data.get("ip_whitelist", [])),
        data.get("billing_plan"),
        data.get("webhook_signing_secret_encrypted"),
    )
    return dict(row)


async def update_partner(partner_id: int, data: dict) -> Optional[dict]:
    fields, values, idx = [], [], 1
    mapping = {
        "name": "name", "partner_type": "partner_type",
        "contact_name": "contact_name", "email": "email", "phone": "phone",
        "webhook_url": "webhook_url", "status": "status",
        "rate_limit_rpm": "rate_limit_rpm",
        "webhook_signing_secret_encrypted": "webhook_signing_secret_encrypted",
    }
    for key, col in mapping.items():
        if key in data:
            fields.append(f"{col} = ${idx}")
            values.append(data[key])
            idx += 1
    for key, col in [
        ("allowed_domains", "allowed_domains"),
        ("allowed_apis", "allowed_apis"),
        ("ip_whitelist", "ip_whitelist"),
    ]:
        if key in data:
            fields.append(f"{col} = ${idx}::jsonb")
            values.append(json.dumps(data[key]))
            idx += 1
    if not fields:
        return None
    fields.append("updated_at = NOW()")
    values.append(partner_id)
    sql = f"UPDATE partners SET {', '.join(fields)} WHERE id = ${idx} RETURNING *"
    row = await db.fetch_row(sql, *values)
    return dict(row) if row else None


async def soft_delete_partner(partner_id: int) -> bool:
    result = await db.execute(
        "UPDATE partners SET deleted_at = NOW(), status = 'disabled' WHERE id = $1",
        partner_id,
    )
    return result == "UPDATE 1"


async def get_webhook_secret(partner_id: int) -> Optional[str]:
    """Return decrypted outbound webhook signing secret for a partner."""
    from app.services.partner_auth_service import decrypt_secret
    row = await db.fetch_row(
        "SELECT webhook_signing_secret_encrypted FROM partners WHERE id = $1",
        partner_id,
    )
    if not row:
        return None
    return decrypt_secret(row.get("webhook_signing_secret_encrypted") or "")


# ── Partner API Keys ──────────────────────────────────────────────────────────

async def get_active_key(api_key: str) -> Optional[dict]:
    """Return the key row together with the partner row for auth validation."""
    row = await db.fetch_row(
        """
        SELECT ak.*, p.name AS partner_name, p.status AS partner_status,
               p.rate_limit_rpm, p.ip_whitelist, p.allowed_apis,
               p.webhook_url
        FROM partner_api_keys ak
        JOIN partners p ON p.id = ak.partner_id
        WHERE ak.api_key = $1
          AND ak.revoked_at IS NULL
          AND p.deleted_at IS NULL
        """,
        api_key,
    )
    return dict(row) if row else None


async def create_api_key(
    partner_id: int,
    api_key: str,
    secret_hash: str,
    environment: str = "sandbox",
    secret_encrypted: str | None = None,
) -> dict:
    row = await db.fetch_row(
        """
        INSERT INTO partner_api_keys
            (partner_id, api_key, secret_hash, environment, secret_encrypted)
        VALUES ($1, $2, $3, $4, $5) RETURNING *
        """,
        partner_id, api_key, secret_hash, environment, secret_encrypted,
    )
    return dict(row)


async def update_key_last_used(api_key: str) -> None:
    await db.execute(
        "UPDATE partner_api_keys SET last_used_at = NOW() WHERE api_key = $1",
        api_key,
    )


async def revoke_key(api_key: str) -> None:
    await db.execute(
        "UPDATE partner_api_keys SET revoked_at = NOW() WHERE api_key = $1",
        api_key,
    )


async def list_keys_for_partner(partner_id: int) -> list:
    return await db.query(
        """
        SELECT id, partner_id, api_key, environment, expires_at,
               last_used_at, revoked_at, created_at
        FROM partner_api_keys
        WHERE partner_id = $1
        ORDER BY created_at DESC
        """,
        partner_id,
    )


# ── Partner Webhooks ──────────────────────────────────────────────────────────

async def create_webhook(
    partner_id: int,
    url: str,
    signing_secret_hash: str,
    events: list,
    signing_secret_encrypted: str | None = None,
) -> dict:
    row = await db.fetch_row(
        """
        INSERT INTO partner_webhooks
            (partner_id, url, signing_secret_hash, events, signing_secret_encrypted)
        VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING *
        """,
        partner_id, url, signing_secret_hash, json.dumps(events), signing_secret_encrypted,
    )
    return dict(row)


async def get_active_webhooks(partner_id: int) -> list:
    return await db.query(
        "SELECT * FROM partner_webhooks WHERE partner_id = $1 AND is_active = true",
        partner_id,
    )


# ── API logs ──────────────────────────────────────────────────────────────────

async def write_api_log(
    partner_id: int,
    endpoint: str,
    method: str,
    request_hash: str | None = None,
    response_code: int | None = None,
    latency_ms: int | None = None,
    error: str | None = None,
    ip_address: str | None = None,
    case_id: int | None = None,
) -> None:
    try:
        await db.execute(
            """
            INSERT INTO partner_api_logs
                (partner_id, case_id, endpoint, method, request_hash,
                 response_code, latency_ms, error, ip_address)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """,
            partner_id, case_id, endpoint, method, request_hash,
            response_code, latency_ms, error, ip_address,
        )
    except Exception:
        # Never break the request path because of logging
        pass


async def list_active_pharmacy_partners() -> list:
    return await db.query(
        """
        SELECT id, public_id, name, status, webhook_url, allowed_apis
        FROM partners
        WHERE partner_type = 'PHARMACY'
          AND status = 'active'
          AND deleted_at IS NULL
        ORDER BY name
        """
    )
