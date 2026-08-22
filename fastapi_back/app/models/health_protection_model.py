"""Health Protection persistence — ensure tables, seed catalog, CRUD helpers."""
from __future__ import annotations

import json
import math
from datetime import date, datetime
from typing import Any, Optional

from app.config.db import db


def _as_dict(value: Any) -> dict[str, Any]:
    """Normalize asyncpg JSONB (dict / str / None) to a plain dict."""
    if value is None:
        return {}
    if isinstance(value, dict):
        return dict(value)
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    if hasattr(value, "items"):
        try:
            return dict(value)
        except Exception:
            return {}
    return {}


def _as_list(value: Any) -> list[Any]:
    """Normalize asyncpg JSONB / array fields to a plain list."""
    if value is None:
        return []
    if isinstance(value, list):
        return list(value)
    if isinstance(value, tuple):
        return list(value)
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


SEED_COMPANIES = [
    ("Star Health", None, 98.5, 4.4),
    ("HDFC ERGO", None, 97.2, 4.3),
    ("Care Health", None, 95.8, 4.2),
    ("Niva Bupa", None, 96.1, 4.3),
    ("ICICI Lombard", None, 94.5, 4.1),
]

SEED_PLANS = [
    # company_name, name, premium, coverage, cashless, wait, room, maternity, critical, ped, dental, vision, pros, cons
    ("Star Health", "Young Star Gold", 899, 500000, 14000, 30, "No limit (single AC)", True, True, 24, False, False,
     ["Strong cashless network", "Maternity add-on friendly", "Good for young families"],
     ["PED waiting period", "Room rent caps on base variants"]),
    ("HDFC ERGO", "Optima Secure", 1299, 1000000, 12000, 30, "Any room", True, True, 36, True, False,
     ["High sum insured options", "Restore benefit", "Dental optional"],
     ["Higher premium", "Strict underwriting"]),
    ("Care Health", "Care Supreme", 749, 500000, 10000, 30, "Shared / twin", False, True, 48, False, False,
     ["Affordable premium", "Critical illness rider", "Wide city coverage"],
     ["Lower maternity support", "Longer PED wait"]),
    ("Niva Bupa", "ReAssure 2.0", 1099, 1000000, 9500, 30, "Any room", True, True, 36, False, True,
     ["Unlimited restore", "Vision cover option", "App-first claims"],
     ["Network thinner in tier-3"]),
    ("ICICI Lombard", "Complete Health", 999, 700000, 8500, 30, "Single private", True, False, 48, False, False,
     ["Balanced premium", "Maternity available", "Brand trust"],
     ["No CI on base", "Co-pay on some plans"]),
    ("Star Health", "Family Health Optima", 1499, 1500000, 14000, 30, "Any room", True, True, 24, False, False,
     ["Family floater", "High coverage", "Cashless heavy"],
     ["Costlier for singles"]),
    ("Care Health", "Joy Maternity Focus", 1199, 500000, 8000, 30, "Twin sharing", True, False, 36, False, False,
     ["Maternity-first", "Newborn cover", "Budget friendly"],
     ["Lower SI", "Limited CI"]),
    ("HDFC ERGO", "my:health Medisure", 649, 300000, 7000, 30, "Shared", False, False, 48, False, False,
     ["Entry-level pricing", "Good starter plan"],
     ["Low SI", "Limited extras"]),
]

SEED_HOSPITALS = [
    ("Apollo Hospitals Jubilee Hills", "Hyderabad", "040-23607777", 17.4239, 78.4482, 4.6, True, True, ["Star Health", "HDFC ERGO", "Care Health"]),
    ("Yashoda Hospitals Secunderabad", "Hyderabad", "040-45674567", 17.4399, 78.4983, 4.5, True, True, ["Star Health", "Niva Bupa", "ICICI Lombard"]),
    ("KIMS Hospitals", "Hyderabad", "040-44885000", 17.4126, 78.4490, 4.4, True, True, ["HDFC ERGO", "Care Health", "Star Health"]),
    ("AIG Hospitals", "Hyderabad", "040-4244-4244", 17.4275, 78.3406, 4.7, True, True, ["Niva Bupa", "HDFC ERGO", "Star Health"]),
    ("Continental Hospitals", "Hyderabad", "040-67000000", 17.4180, 78.3478, 4.3, True, True, ["ICICI Lombard", "Care Health"]),
]


async def ensure_health_protection_tables() -> None:
    """Idempotent DDL for environments that have not run migrations yet."""
    statements = [
        """
        CREATE TABLE IF NOT EXISTS hp_insurance_companies (
            id BIGSERIAL PRIMARY KEY,
            name VARCHAR(200) NOT NULL UNIQUE,
            logo_url TEXT,
            claim_ratio NUMERIC(5,2) DEFAULT 90,
            rating NUMERIC(3,2) DEFAULT 4.0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS hp_insurance_plans (
            id BIGSERIAL PRIMARY KEY,
            company_id BIGINT NOT NULL REFERENCES hp_insurance_companies(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            monthly_premium NUMERIC(12,2) NOT NULL DEFAULT 0,
            coverage_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
            cashless_hospitals_count INT NOT NULL DEFAULT 0,
            waiting_period_days INT NOT NULL DEFAULT 30,
            room_rent VARCHAR(120),
            maternity BOOLEAN NOT NULL DEFAULT FALSE,
            critical_illness BOOLEAN NOT NULL DEFAULT FALSE,
            ped_waiting_days INT NOT NULL DEFAULT 365,
            dental BOOLEAN NOT NULL DEFAULT FALSE,
            vision BOOLEAN NOT NULL DEFAULT FALSE,
            network_notes TEXT,
            pros TEXT[],
            cons TEXT[],
            features JSONB NOT NULL DEFAULT '{}'::jsonb,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS hp_user_policies (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            plan_id BIGINT REFERENCES hp_insurance_plans(id) ON DELETE SET NULL,
            company_name VARCHAR(200),
            policy_number VARCHAR(120),
            coverage_amount NUMERIC(14,2) DEFAULT 0,
            premium NUMERIC(12,2) DEFAULT 0,
            status VARCHAR(40) NOT NULL DEFAULT 'active',
            starts_at DATE,
            expires_at DATE,
            members_covered INT NOT NULL DEFAULT 1,
            has_critical BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS hp_health_scores (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            score INT NOT NULL,
            factors JSONB NOT NULL DEFAULT '{}'::jsonb,
            suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
            computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS hp_emergency_cards (
            user_id BIGINT PRIMARY KEY,
            photo_url TEXT,
            blood_group VARCHAR(10),
            policy_number VARCHAR(120),
            company VARCHAR(200),
            coverage VARCHAR(120),
            emergency_contact_name VARCHAR(120),
            emergency_contact_phone VARCHAR(40),
            qr_payload TEXT,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS hp_family_members (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            relation VARCHAR(40) NOT NULL,
            name VARCHAR(120) NOT NULL,
            coverage_amount NUMERIC(14,2) DEFAULT 0,
            status VARCHAR(40) NOT NULL DEFAULT 'covered',
            renewal_date DATE,
            medical_history TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS hp_claims (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            title VARCHAR(255) NOT NULL DEFAULT 'Insurance claim',
            amount_claimed NUMERIC(14,2) DEFAULT 0,
            amount_approved NUMERIC(14,2),
            status VARCHAR(40) NOT NULL DEFAULT 'draft',
            timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
            expected_settlement DATE,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS hp_claim_documents (
            id BIGSERIAL PRIMARY KEY,
            claim_id BIGINT NOT NULL REFERENCES hp_claims(id) ON DELETE CASCADE,
            doc_type VARCHAR(40) NOT NULL,
            file_url TEXT NOT NULL,
            public_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS hp_policy_uploads (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            file_url TEXT NOT NULL,
            public_id TEXT,
            file_name VARCHAR(255),
            summary JSONB NOT NULL DEFAULT '{}'::jsonb,
            plain_explanation TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS hp_expenses (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            category VARCHAR(40) NOT NULL,
            amount NUMERIC(14,2) NOT NULL,
            spent_at DATE NOT NULL DEFAULT CURRENT_DATE,
            note TEXT,
            claim_id BIGINT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS hp_risk_scores (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            level VARCHAR(20) NOT NULL,
            score INT NOT NULL,
            inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
            recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
            computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS hp_chat_messages (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            role VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS hp_cashless_hospitals (
            id BIGSERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            address TEXT,
            phone VARCHAR(40),
            lat DOUBLE PRECISION,
            lng DOUBLE PRECISION,
            rating NUMERIC(3,2) DEFAULT 4.0,
            open_now BOOLEAN NOT NULL DEFAULT TRUE,
            emergency BOOLEAN NOT NULL DEFAULT TRUE,
            insurer_tags TEXT[] NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS hp_notifications_log (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            type VARCHAR(60) NOT NULL,
            payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
    ]
    for sql in statements:
        await db.execute(sql)
    await seed_catalog_if_empty()


async def seed_catalog_if_empty() -> None:
    row = await db.fetch_row("SELECT COUNT(*)::int AS c FROM hp_insurance_companies")
    if row and int(row["c"] or 0) > 0:
        # still seed hospitals if empty
        h = await db.fetch_row("SELECT COUNT(*)::int AS c FROM hp_cashless_hospitals")
        if h and int(h["c"] or 0) == 0:
            await _seed_hospitals()
        return

    for name, logo, ratio, rating in SEED_COMPANIES:
        await db.execute(
            """
            INSERT INTO hp_insurance_companies (name, logo_url, claim_ratio, rating)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (name) DO NOTHING
            """,
            name,
            logo,
            ratio,
            rating,
        )

    for item in SEED_PLANS:
        (
            company,
            pname,
            premium,
            coverage,
            cashless,
            wait,
            room,
            maternity,
            critical,
            ped,
            dental,
            vision,
            pros,
            cons,
        ) = item
        crow = await db.fetch_row(
            "SELECT id FROM hp_insurance_companies WHERE name = $1", company
        )
        if not crow:
            continue
        await db.execute(
            """
            INSERT INTO hp_insurance_plans (
                company_id, name, monthly_premium, coverage_amount,
                cashless_hospitals_count, waiting_period_days, room_rent,
                maternity, critical_illness, ped_waiting_days, dental, vision,
                pros, cons, features
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb
            )
            """,
            int(crow["id"]),
            pname,
            premium,
            coverage,
            cashless,
            wait,
            room,
            maternity,
            critical,
            ped,
            dental,
            vision,
            pros,
            cons,
            json.dumps({"seed": True}),
        )
    await _seed_hospitals()


async def _seed_hospitals() -> None:
    for name, address, phone, lat, lng, rating, open_now, emergency, tags in SEED_HOSPITALS:
        await db.execute(
            """
            INSERT INTO hp_cashless_hospitals
                (name, address, phone, lat, lng, rating, open_now, emergency, insurer_tags)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            """,
            name,
            address,
            phone,
            lat,
            lng,
            rating,
            open_now,
            emergency,
            tags,
        )


def _num(v: Any, default: float = 0.0) -> float:
    try:
        return float(v) if v is not None else default
    except (TypeError, ValueError):
        return default


def _date_iso(v: Any) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, (date, datetime)):
        return v.isoformat() if isinstance(v, datetime) else v.isoformat()
    return str(v)


def plan_row(row) -> dict[str, Any]:
    if not row:
        return {}
    return {
        "id": int(row["id"]),
        "companyId": int(row["company_id"]) if row.get("company_id") else None,
        "companyName": row.get("company_name") or row.get("cname"),
        "logoUrl": row.get("logo_url"),
        "claimRatio": _num(row.get("claim_ratio"), 90),
        "companyRating": _num(row.get("rating"), 4),
        "name": row["name"],
        "monthlyPremium": _num(row["monthly_premium"]),
        "coverageAmount": _num(row["coverage_amount"]),
        "cashlessHospitals": int(row["cashless_hospitals_count"] or 0),
        "waitingPeriodDays": int(row["waiting_period_days"] or 0),
        "roomRent": row.get("room_rent"),
        "maternity": bool(row.get("maternity")),
        "criticalIllness": bool(row.get("critical_illness")),
        "pedWaitingDays": int(row.get("ped_waiting_days") or 0),
        "dental": bool(row.get("dental")),
        "vision": bool(row.get("vision")),
        "networkNotes": row.get("network_notes"),
        "pros": list(row.get("pros") or []),
        "cons": list(row.get("cons") or []),
        "features": _as_dict(row.get("features")),
    }


async def list_companies() -> list[dict[str, Any]]:
    rows = await db.query(
        "SELECT * FROM hp_insurance_companies ORDER BY name ASC"
    )
    return [
        {
            "id": int(r["id"]),
            "name": r["name"],
            "logoUrl": r["logo_url"],
            "claimRatio": _num(r["claim_ratio"]),
            "rating": _num(r["rating"]),
        }
        for r in rows
    ]


async def list_plans(*, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
    rows = await db.query(
        """
        SELECT p.*, c.name AS company_name, c.logo_url, c.claim_ratio, c.rating
        FROM hp_insurance_plans p
        JOIN hp_insurance_companies c ON c.id = p.company_id
        WHERE p.is_active = TRUE
        ORDER BY p.monthly_premium ASC
        LIMIT $1 OFFSET $2
        """,
        int(limit),
        int(offset),
    )
    return [plan_row(r) for r in rows]


async def get_plan(plan_id: int) -> Optional[dict[str, Any]]:
    row = await db.fetch_row(
        """
        SELECT p.*, c.name AS company_name, c.logo_url, c.claim_ratio, c.rating
        FROM hp_insurance_plans p
        JOIN hp_insurance_companies c ON c.id = p.company_id
        WHERE p.id = $1
        """,
        int(plan_id),
    )
    return plan_row(row) if row else None


async def get_plans_by_ids(ids: list[int]) -> list[dict[str, Any]]:
    if not ids:
        return []
    rows = await db.query(
        """
        SELECT p.*, c.name AS company_name, c.logo_url, c.claim_ratio, c.rating
        FROM hp_insurance_plans p
        JOIN hp_insurance_companies c ON c.id = p.company_id
        WHERE p.id = ANY($1::bigint[])
        """,
        ids,
    )
    return [plan_row(r) for r in rows]


async def list_user_policies(user_id: int) -> list[dict[str, Any]]:
    rows = await db.query(
        """
        SELECT * FROM hp_user_policies
        WHERE user_id = $1
        ORDER BY created_at DESC
        """,
        int(user_id),
    )
    return [_policy_row(r) for r in rows]


def _policy_row(r) -> dict[str, Any]:
    return {
        "id": int(r["id"]),
        "planId": int(r["plan_id"]) if r["plan_id"] else None,
        "companyName": r["company_name"],
        "policyNumber": r["policy_number"],
        "coverageAmount": _num(r["coverage_amount"]),
        "premium": _num(r["premium"]),
        "status": r["status"],
        "startsAt": _date_iso(r["starts_at"]),
        "expiresAt": _date_iso(r["expires_at"]),
        "membersCovered": int(r["members_covered"] or 1),
        "hasCritical": bool(r["has_critical"]),
    }


async def create_policy(user_id: int, body: dict[str, Any]) -> dict[str, Any]:
    row = await db.fetch_row(
        """
        INSERT INTO hp_user_policies (
            user_id, plan_id, company_name, policy_number, coverage_amount,
            premium, status, starts_at, expires_at, members_covered, has_critical
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *
        """,
        int(user_id),
        body.get("planId"),
        body.get("companyName"),
        body.get("policyNumber"),
        _num(body.get("coverageAmount")),
        _num(body.get("premium")),
        body.get("status") or "active",
        body.get("startsAt"),
        body.get("expiresAt"),
        int(body.get("membersCovered") or 1),
        bool(body.get("hasCritical")),
    )
    return _policy_row(row)


async def update_policy(user_id: int, policy_id: int, body: dict[str, Any]) -> Optional[dict[str, Any]]:
    existing = await db.fetch_row(
        "SELECT * FROM hp_user_policies WHERE id = $1 AND user_id = $2",
        int(policy_id),
        int(user_id),
    )
    if not existing:
        return None
    row = await db.fetch_row(
        """
        UPDATE hp_user_policies SET
            company_name = COALESCE($3, company_name),
            policy_number = COALESCE($4, policy_number),
            coverage_amount = COALESCE($5, coverage_amount),
            premium = COALESCE($6, premium),
            status = COALESCE($7, status),
            starts_at = COALESCE($8, starts_at),
            expires_at = COALESCE($9, expires_at),
            members_covered = COALESCE($10, members_covered),
            has_critical = COALESCE($11, has_critical),
            updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING *
        """,
        int(policy_id),
        int(user_id),
        body.get("companyName"),
        body.get("policyNumber"),
        body.get("coverageAmount"),
        body.get("premium"),
        body.get("status"),
        body.get("startsAt"),
        body.get("expiresAt"),
        body.get("membersCovered"),
        body.get("hasCritical"),
    )
    return _policy_row(row) if row else None


async def save_health_score(
    user_id: int, score: int, factors: dict, suggestions: list
) -> dict[str, Any]:
    row = await db.fetch_row(
        """
        INSERT INTO hp_health_scores (user_id, score, factors, suggestions)
        VALUES ($1, $2, $3::jsonb, $4::jsonb)
        RETURNING *
        """,
        int(user_id),
        int(score),
        json.dumps(factors),
        json.dumps(suggestions),
    )
    return {
        "score": int(row["score"]),
        "factors": _as_dict(row["factors"]),
        "suggestions": _as_list(row["suggestions"]),
        "computedAt": _date_iso(row["computed_at"]),
    }


async def latest_health_score(user_id: int) -> Optional[dict[str, Any]]:
    row = await db.fetch_row(
        """
        SELECT * FROM hp_health_scores
        WHERE user_id = $1
        ORDER BY computed_at DESC
        LIMIT 1
        """,
        int(user_id),
    )
    if not row:
        return None
    return {
        "score": int(row["score"]),
        "factors": _as_dict(row["factors"]),
        "suggestions": _as_list(row["suggestions"]),
        "computedAt": _date_iso(row["computed_at"]),
    }


async def score_history(user_id: int, limit: int = 12) -> list[dict[str, Any]]:
    rows = await db.query(
        """
        SELECT score, computed_at FROM hp_health_scores
        WHERE user_id = $1
        ORDER BY computed_at DESC
        LIMIT $2
        """,
        int(user_id),
        int(limit),
    )
    return [
        {"score": int(r["score"]), "computedAt": _date_iso(r["computed_at"])}
        for r in rows
    ]


async def get_emergency_card(user_id: int) -> Optional[dict[str, Any]]:
    row = await db.fetch_row(
        "SELECT * FROM hp_emergency_cards WHERE user_id = $1", int(user_id)
    )
    if not row:
        return None
    return _card_row(row)


def _card_row(row) -> dict[str, Any]:
    return {
        "photoUrl": row["photo_url"],
        "bloodGroup": row["blood_group"],
        "policyNumber": row["policy_number"],
        "company": row["company"],
        "coverage": row["coverage"],
        "emergencyContactName": row["emergency_contact_name"],
        "emergencyContactPhone": row["emergency_contact_phone"],
        "qrPayload": row["qr_payload"],
        "updatedAt": _date_iso(row["updated_at"]),
    }


async def upsert_emergency_card(user_id: int, body: dict[str, Any]) -> dict[str, Any]:
    qr = body.get("qrPayload") or json.dumps(
        {
            "policy": body.get("policyNumber"),
            "company": body.get("company"),
            "blood": body.get("bloodGroup"),
            "emergency": body.get("emergencyContactPhone"),
        }
    )
    row = await db.fetch_row(
        """
        INSERT INTO hp_emergency_cards (
            user_id, photo_url, blood_group, policy_number, company, coverage,
            emergency_contact_name, emergency_contact_phone, qr_payload, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            photo_url = COALESCE(EXCLUDED.photo_url, hp_emergency_cards.photo_url),
            blood_group = COALESCE(EXCLUDED.blood_group, hp_emergency_cards.blood_group),
            policy_number = COALESCE(EXCLUDED.policy_number, hp_emergency_cards.policy_number),
            company = COALESCE(EXCLUDED.company, hp_emergency_cards.company),
            coverage = COALESCE(EXCLUDED.coverage, hp_emergency_cards.coverage),
            emergency_contact_name = COALESCE(EXCLUDED.emergency_contact_name, hp_emergency_cards.emergency_contact_name),
            emergency_contact_phone = COALESCE(EXCLUDED.emergency_contact_phone, hp_emergency_cards.emergency_contact_phone),
            qr_payload = EXCLUDED.qr_payload,
            updated_at = NOW()
        RETURNING *
        """,
        int(user_id),
        body.get("photoUrl"),
        body.get("bloodGroup"),
        body.get("policyNumber"),
        body.get("company"),
        body.get("coverage"),
        body.get("emergencyContactName"),
        body.get("emergencyContactPhone"),
        qr,
    )
    return _card_row(row)


# ---- family ----
async def list_family(user_id: int) -> list[dict[str, Any]]:
    rows = await db.query(
        "SELECT * FROM hp_family_members WHERE user_id = $1 ORDER BY id ASC",
        int(user_id),
    )
    return [_family_row(r) for r in rows]


def _family_row(r) -> dict[str, Any]:
    return {
        "id": int(r["id"]),
        "relation": r["relation"],
        "name": r["name"],
        "coverageAmount": _num(r["coverage_amount"]),
        "status": r["status"],
        "renewalDate": _date_iso(r["renewal_date"]),
        "medicalHistory": r["medical_history"],
    }


async def add_family(user_id: int, body: dict[str, Any]) -> dict[str, Any]:
    row = await db.fetch_row(
        """
        INSERT INTO hp_family_members
            (user_id, relation, name, coverage_amount, status, renewal_date, medical_history)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
        """,
        int(user_id),
        body.get("relation") or "other",
        body.get("name") or "Member",
        _num(body.get("coverageAmount")),
        body.get("status") or "covered",
        body.get("renewalDate"),
        body.get("medicalHistory"),
    )
    return _family_row(row)


async def update_family(user_id: int, member_id: int, body: dict[str, Any]) -> Optional[dict[str, Any]]:
    row = await db.fetch_row(
        """
        UPDATE hp_family_members SET
            relation = COALESCE($3, relation),
            name = COALESCE($4, name),
            coverage_amount = COALESCE($5, coverage_amount),
            status = COALESCE($6, status),
            renewal_date = COALESCE($7, renewal_date),
            medical_history = COALESCE($8, medical_history)
        WHERE id = $1 AND user_id = $2
        RETURNING *
        """,
        int(member_id),
        int(user_id),
        body.get("relation"),
        body.get("name"),
        body.get("coverageAmount"),
        body.get("status"),
        body.get("renewalDate"),
        body.get("medicalHistory"),
    )
    return _family_row(row) if row else None


async def delete_family(user_id: int, member_id: int) -> bool:
    result = await db.execute(
        "DELETE FROM hp_family_members WHERE id = $1 AND user_id = $2",
        int(member_id),
        int(user_id),
    )
    return result.endswith("1") if isinstance(result, str) else True


# ---- claims ----
async def list_claims(user_id: int) -> list[dict[str, Any]]:
    rows = await db.query(
        "SELECT * FROM hp_claims WHERE user_id = $1 ORDER BY created_at DESC",
        int(user_id),
    )
    out = []
    for r in rows:
        docs = await db.query(
            "SELECT * FROM hp_claim_documents WHERE claim_id = $1", int(r["id"])
        )
        out.append(_claim_row(r, docs))
    return out


def _claim_row(r, docs=None) -> dict[str, Any]:
    return {
        "id": int(r["id"]),
        "title": r["title"],
        "amountClaimed": _num(r["amount_claimed"]),
        "amountApproved": _num(r["amount_approved"]) if r["amount_approved"] is not None else None,
        "status": r["status"],
        "timeline": _as_list(r["timeline"]),
        "expectedSettlement": _date_iso(r["expected_settlement"]),
        "notes": r["notes"],
        "createdAt": _date_iso(r["created_at"]),
        "documents": [
            {
                "id": int(d["id"]),
                "docType": d["doc_type"],
                "fileUrl": d["file_url"],
            }
            for d in (docs or [])
        ],
    }


async def create_claim(user_id: int, body: dict[str, Any]) -> dict[str, Any]:
    timeline = [
        {
            "status": "draft",
            "at": datetime.utcnow().isoformat() + "Z",
            "note": "Claim created",
        }
    ]
    row = await db.fetch_row(
        """
        INSERT INTO hp_claims (user_id, title, amount_claimed, status, timeline, notes)
        VALUES ($1,$2,$3,'draft',$4::jsonb,$5)
        RETURNING *
        """,
        int(user_id),
        body.get("title") or "Insurance claim",
        _num(body.get("amountClaimed")),
        json.dumps(timeline),
        body.get("notes"),
    )
    return _claim_row(row, [])


async def get_claim(user_id: int, claim_id: int) -> Optional[dict[str, Any]]:
    row = await db.fetch_row(
        "SELECT * FROM hp_claims WHERE id = $1 AND user_id = $2",
        int(claim_id),
        int(user_id),
    )
    if not row:
        return None
    docs = await db.query(
        "SELECT * FROM hp_claim_documents WHERE claim_id = $1", int(claim_id)
    )
    return _claim_row(row, docs)


async def add_claim_document(
    user_id: int, claim_id: int, doc_type: str, file_url: str, public_id: Optional[str]
) -> Optional[dict[str, Any]]:
    claim = await get_claim(user_id, claim_id)
    if not claim:
        return None
    await db.execute(
        """
        INSERT INTO hp_claim_documents (claim_id, doc_type, file_url, public_id)
        VALUES ($1,$2,$3,$4)
        """,
        int(claim_id),
        doc_type,
        file_url,
        public_id,
    )
    return await get_claim(user_id, claim_id)


async def submit_claim(user_id: int, claim_id: int) -> Optional[dict[str, Any]]:
    claim = await get_claim(user_id, claim_id)
    if not claim:
        return None
    timeline = list(claim.get("timeline") or [])
    timeline.append(
        {
            "status": "submitted",
            "at": datetime.utcnow().isoformat() + "Z",
            "note": "Claim submitted for review",
        }
    )
    timeline.append(
        {
            "status": "under_review",
            "at": datetime.utcnow().isoformat() + "Z",
            "note": "Under review by insurer desk (simulated)",
        }
    )
    from datetime import timedelta

    settle = date.today() + timedelta(days=14)
    row = await db.fetch_row(
        """
        UPDATE hp_claims SET
            status = 'under_review',
            timeline = $3::jsonb,
            expected_settlement = $4,
            updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING *
        """,
        int(claim_id),
        int(user_id),
        json.dumps(timeline),
        settle,
    )
    docs = await db.query(
        "SELECT * FROM hp_claim_documents WHERE claim_id = $1", int(claim_id)
    )
    return _claim_row(row, docs)


# ---- policy uploads ----
async def save_policy_upload(
    user_id: int,
    file_url: str,
    public_id: Optional[str],
    file_name: Optional[str],
    summary: dict,
    explanation: str,
) -> dict[str, Any]:
    row = await db.fetch_row(
        """
        INSERT INTO hp_policy_uploads
            (user_id, file_url, public_id, file_name, summary, plain_explanation)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6)
        RETURNING *
        """,
        int(user_id),
        file_url,
        public_id,
        file_name,
        json.dumps(summary),
        explanation,
    )
    return {
        "id": int(row["id"]),
        "fileUrl": row["file_url"],
        "fileName": row["file_name"],
        "summary": _as_dict(row["summary"]),
        "plainExplanation": row["plain_explanation"],
        "createdAt": _date_iso(row["created_at"]),
    }


async def list_policy_uploads(user_id: int) -> list[dict[str, Any]]:
    rows = await db.query(
        """
        SELECT * FROM hp_policy_uploads
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 20
        """,
        int(user_id),
    )
    return [
        {
            "id": int(r["id"]),
            "fileUrl": r["file_url"],
            "fileName": r["file_name"],
            "summary": _as_dict(r["summary"]),
            "plainExplanation": r["plain_explanation"],
            "createdAt": _date_iso(r["created_at"]),
        }
        for r in rows
    ]


# ---- expenses ----
async def list_expenses(user_id: int, limit: int = 100) -> list[dict[str, Any]]:
    rows = await db.query(
        """
        SELECT * FROM hp_expenses
        WHERE user_id = $1
        ORDER BY spent_at DESC, id DESC
        LIMIT $2
        """,
        int(user_id),
        int(limit),
    )
    return [
        {
            "id": int(r["id"]),
            "category": r["category"],
            "amount": _num(r["amount"]),
            "spentAt": _date_iso(r["spent_at"]),
            "note": r["note"],
            "claimId": int(r["claim_id"]) if r["claim_id"] else None,
        }
        for r in rows
    ]


async def add_expense(user_id: int, body: dict[str, Any]) -> dict[str, Any]:
    row = await db.fetch_row(
        """
        INSERT INTO hp_expenses (user_id, category, amount, spent_at, note, claim_id)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *
        """,
        int(user_id),
        body.get("category") or "other",
        _num(body.get("amount")),
        body.get("spentAt") or date.today(),
        body.get("note"),
        body.get("claimId"),
    )
    return {
        "id": int(row["id"]),
        "category": row["category"],
        "amount": _num(row["amount"]),
        "spentAt": _date_iso(row["spent_at"]),
        "note": row["note"],
        "claimId": int(row["claim_id"]) if row["claim_id"] else None,
    }


async def delete_expense(user_id: int, expense_id: int) -> bool:
    await db.execute(
        "DELETE FROM hp_expenses WHERE id = $1 AND user_id = $2",
        int(expense_id),
        int(user_id),
    )
    return True


# ---- risk ----
async def save_risk(user_id: int, level: str, score: int, inputs: dict, recs: list) -> dict:
    row = await db.fetch_row(
        """
        INSERT INTO hp_risk_scores (user_id, level, score, inputs, recommendations)
        VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)
        RETURNING *
        """,
        int(user_id),
        level,
        int(score),
        json.dumps(inputs),
        json.dumps(recs),
    )
    return {
        "level": row["level"],
        "score": int(row["score"]),
        "inputs": _as_dict(row["inputs"]),
        "recommendations": _as_list(row["recommendations"]),
        "computedAt": _date_iso(row["computed_at"]),
    }


async def latest_risk(user_id: int) -> Optional[dict]:
    row = await db.fetch_row(
        """
        SELECT * FROM hp_risk_scores WHERE user_id = $1
        ORDER BY computed_at DESC LIMIT 1
        """,
        int(user_id),
    )
    if not row:
        return None
    return {
        "level": row["level"],
        "score": int(row["score"]),
        "inputs": _as_dict(row["inputs"]),
        "recommendations": _as_list(row["recommendations"]),
        "computedAt": _date_iso(row["computed_at"]),
    }


# ---- chat ----
async def add_chat(user_id: int, role: str, content: str) -> None:
    await db.execute(
        "INSERT INTO hp_chat_messages (user_id, role, content) VALUES ($1,$2,$3)",
        int(user_id),
        role,
        content,
    )


async def chat_history(user_id: int, limit: int = 40) -> list[dict]:
    rows = await db.query(
        """
        SELECT role, content, created_at FROM hp_chat_messages
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        int(user_id),
        int(limit),
    )
    items = [
        {
            "role": r["role"],
            "content": r["content"],
            "createdAt": _date_iso(r["created_at"]),
        }
        for r in rows
    ]
    items.reverse()
    return items


# ---- cashless ----
def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


async def list_cashless(
    *,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = 25,
    insurer: Optional[str] = None,
) -> list[dict[str, Any]]:
    rows = await db.query("SELECT * FROM hp_cashless_hospitals ORDER BY name ASC")
    out = []
    for r in rows:
        tags = list(r["insurer_tags"] or [])
        if insurer and insurer.lower() not in [t.lower() for t in tags]:
            continue
        dist = None
        if lat is not None and lng is not None and r["lat"] is not None and r["lng"] is not None:
            dist = round(haversine_km(lat, lng, float(r["lat"]), float(r["lng"])), 2)
            if dist > radius_km:
                continue
        out.append(
            {
                "id": int(r["id"]),
                "name": r["name"],
                "address": r["address"],
                "phone": r["phone"],
                "lat": r["lat"],
                "lng": r["lng"],
                "rating": _num(r["rating"]),
                "openNow": bool(r["open_now"]),
                "emergency": bool(r["emergency"]),
                "insurersAccepted": tags,
                "distanceKm": dist,
            }
        )
    out.sort(key=lambda x: x["distanceKm"] if x["distanceKm"] is not None else 9999)
    return out


async def log_notification(user_id: int, ntype: str, payload: dict) -> None:
    await db.execute(
        """
        INSERT INTO hp_notifications_log (user_id, type, payload)
        VALUES ($1,$2,$3::jsonb)
        """,
        int(user_id),
        ntype,
        json.dumps(payload),
    )
