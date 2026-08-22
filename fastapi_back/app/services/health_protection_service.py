"""Health Protection business logic — score, AI recommend, claims, analytics."""
from __future__ import annotations

import io
import json
import logging
from datetime import date, datetime, timedelta
from typing import Any, Optional

from app.models import health_protection_model as m

log = logging.getLogger("medclues.health_protection")


class HPError(Exception):
    def __init__(self, message: str, status_code: int = 400, code: str = "hp_error"):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


def _ok(data: Any = None, **extra) -> dict[str, Any]:
    out: dict[str, Any] = {"success": True}
    if data is not None:
        out["data"] = data
    out.update(extra)
    return out


# ---------- Score engine ----------
async def _user_signals(user_id: int) -> dict[str, Any]:
    policies = await m.list_user_policies(user_id)
    active = [p for p in policies if (p.get("status") or "").lower() == "active"]
    family = await m.list_family(user_id)
    card = await m.get_emergency_card(user_id)

    blood = None
    emergency_phone = None
    if card:
        blood = card.get("bloodGroup")
        emergency_phone = card.get("emergencyContactPhone")

    # Best-effort profile / records signals
    has_records = False
    profile_blood = None
    try:
        from app.config.db import db

        u = await db.fetch_row(
            "SELECT blood_group, phone FROM users WHERE id = $1", int(user_id)
        )
        if u:
            profile_blood = u.get("blood_group")
            if not emergency_phone and u.get("phone"):
                emergency_phone = str(u["phone"])
        rec = await db.fetch_row(
            "SELECT COUNT(*)::int AS c FROM health_records WHERE user_id = $1",
            int(user_id),
        )
        has_records = bool(rec and int(rec["c"] or 0) > 0)
    except Exception:
        pass

    blood = blood or profile_blood
    has_critical = any(p.get("hasCritical") for p in active)
    members = max([p.get("membersCovered") or 1 for p in active], default=0)
    if family:
        members = max(members, len(family))

    return {
        "hasInsurance": len(active) > 0,
        "hasEmergencyContact": bool(emergency_phone),
        "hasBloodGroup": bool(blood),
        "hasMedicalRecords": has_records,
        "hasVaccination": False,  # no dedicated table yet — suggestion-driven
        "hasAnnualCheckup": False,
        "hasFamilyCoverage": members > 1 or len(family) > 0,
        "hasCriticalIllness": has_critical,
        "activePolicies": active,
        "familyCount": len(family),
        "bloodGroup": blood,
        "emergencyPhone": emergency_phone,
    }


def compute_score_from_signals(signals: dict[str, Any]) -> tuple[int, dict, list]:
    weights = {
        "hasInsurance": 25,
        "hasEmergencyContact": 15,
        "hasBloodGroup": 10,
        "hasMedicalRecords": 15,
        "hasVaccination": 5,
        "hasAnnualCheckup": 10,
        "hasFamilyCoverage": 10,
        "hasCriticalIllness": 10,
    }
    factors = {}
    score = 0
    for key, w in weights.items():
        ok = bool(signals.get(key))
        factors[key] = {"ok": ok, "weight": w, "earned": w if ok else 0}
        if ok:
            score += w

    suggestions = []
    if not signals.get("hasInsurance"):
        suggestions.append("Add an active health policy to boost your protection score.")
    if not signals.get("hasEmergencyContact"):
        suggestions.append("Add an emergency contact on your digital insurance card.")
    if not signals.get("hasBloodGroup"):
        suggestions.append("Save your blood group for faster emergency care.")
    if not signals.get("hasMedicalRecords"):
        suggestions.append("Upload medical records so claims and care are faster.")
    if not signals.get("hasVaccination"):
        suggestions.append("Log vaccinations in Records when available.")
    if not signals.get("hasAnnualCheckup"):
        suggestions.append("Book an annual health checkup with a MEDCLUES doctor.")
    if not signals.get("hasFamilyCoverage"):
        suggestions.append("Add family members or switch to a family floater plan.")
    if not signals.get("hasCriticalIllness"):
        suggestions.append("Consider a critical illness rider on your next renewal.")

    return min(100, score), factors, suggestions


async def recompute_score(user_id: int) -> dict[str, Any]:
    signals = await _user_signals(user_id)
    score, factors, suggestions = compute_score_from_signals(signals)
    saved = await m.save_health_score(user_id, score, factors, suggestions)
    return saved


async def get_score(user_id: int) -> dict[str, Any]:
    latest = await m.latest_health_score(user_id)
    if not latest:
        latest = await recompute_score(user_id)
    return latest


async def hub(user_id: int) -> dict[str, Any]:
    score = await get_score(user_id)
    policies = await m.list_user_policies(user_id)
    active = next(
        (p for p in policies if (p.get("status") or "").lower() == "active"),
        policies[0] if policies else None,
    )
    family = await m.list_family(user_id)
    days_remaining = None
    if active and active.get("expiresAt"):
        try:
            exp = date.fromisoformat(str(active["expiresAt"])[:10])
            days_remaining = (exp - date.today()).days
        except Exception:
            days_remaining = None

    risk = "Low"
    s = int(score.get("score") or 0)
    if s < 50:
        risk = "High"
    elif s < 75:
        risk = "Medium"

    return _ok(
        {
            "score": score,
            "riskIndicator": risk,
            "policy": active,
            "insuranceActive": bool(active),
            "familyMembersCovered": len(family)
            or (active.get("membersCovered") if active else 0),
            "policyExpiry": active.get("expiresAt") if active else None,
            "daysRemaining": days_remaining,
            "quickLinks": [
                {"id": "recommend", "label": "AI Recommendations"},
                {"id": "analyze", "label": "Policy Analyzer"},
                {"id": "claims", "label": "Claim Assistant"},
                {"id": "cashless", "label": "Cashless Hospitals"},
                {"id": "family", "label": "Family"},
                {"id": "expenses", "label": "Expenses"},
                {"id": "risk", "label": "Medical Risk"},
                {"id": "chat", "label": "AI Chat"},
                {"id": "emergency", "label": "Emergency Card"},
                {"id": "eligibility", "label": "Eligibility"},
                {"id": "compare", "label": "Compare Plans"},
            ],
        }
    )


# ---------- Recommendations ----------
def _rank_plans(plans: list[dict], q: dict[str, Any]) -> list[dict]:
    budget = float(q.get("budget") or q.get("monthlyBudget") or 2000)
    need_maternity = bool(q.get("maternity") or (q.get("familyMembers") or 0) > 2)
    smoking = bool(q.get("smoking"))
    conditions = (q.get("medicalConditions") or q.get("conditions") or "")
    conditions_l = str(conditions).lower()
    has_conditions = bool(conditions_l and conditions_l not in ("none", "no", ""))

    ranked = []
    for p in plans:
        score = 70.0
        premium = float(p.get("monthlyPremium") or 0)
        if premium <= budget:
            score += 15
        else:
            score -= min(25, (premium - budget) / max(budget, 1) * 20)

        if need_maternity and p.get("maternity"):
            score += 8
        if q.get("preferCritical") or has_conditions:
            if p.get("criticalIllness"):
                score += 8
        if smoking:
            score -= 3
        if has_conditions:
            # shorter PED better
            ped = int(p.get("pedWaitingDays") or 365)
            score += max(0, 10 - ped / 100)
        cashless = int(p.get("cashlessHospitals") or 0)
        score += min(10, cashless / 2000)
        score = max(40, min(99, round(score, 1)))

        why = []
        if premium <= budget:
            why.append("Fits your monthly budget")
        if p.get("maternity") and need_maternity:
            why.append("Includes maternity coverage for your family profile")
        if p.get("criticalIllness"):
            why.append("Critical illness protection available")
        if cashless > 8000:
            why.append("Large cashless hospital network")
        if not why:
            why.append("Balanced premium and coverage for your profile")

        ranked.append(
            {
                **p,
                "aiRecommendationScore": score,
                "whyRecommended": why,
                "pros": p.get("pros") or [],
                "cons": p.get("cons") or [],
            }
        )

    ranked.sort(key=lambda x: x["aiRecommendationScore"], reverse=True)
    return ranked[:5]


async def recommend(user_id: int, body: dict[str, Any]) -> dict[str, Any]:
    age = body.get("age")
    if age is not None and (int(age) < 1 or int(age) > 100):
        raise HPError("Invalid age", 400, "validation_error")
    plans = await m.list_plans(limit=50)
    if not plans:
        raise HPError("No plans in catalog", 404, "not_found")

    top = _rank_plans(plans, body or {})

    # Optional AI polish
    try:
        from app.services import mistral_service

        prompt = (
            "You are a health insurance advisor for India. "
            f"User profile: {json.dumps(body)}. "
            f"Top plans: {json.dumps([{ 'name': p['name'], 'company': p.get('companyName'), 'premium': p['monthlyPremium'], 'coverage': p['coverageAmount']} for p in top])}. "
            "Return a short JSON object with key overview (string, max 80 words) explaining the ranking. No markdown."
        )
        text = await mistral_service.generate_structured_response(prompt)
        overview = text if isinstance(text, str) else str(text)
    except Exception as exc:
        log.warning("recommend AI polish skipped: %s", exc)
        overview = (
            "Plans ranked by budget fit, maternity/critical needs, PED waiting, "
            "and cashless network size. Review policy wordings before purchase."
        )

    return _ok({"recommendations": top, "overview": overview, "profile": body})


async def compare_plans(body: dict[str, Any]) -> dict[str, Any]:
    ids = body.get("planIds") or body.get("plan_ids") or []
    if not isinstance(ids, list) or len(ids) < 2:
        raise HPError("Provide at least 2 planIds", 400, "validation_error")
    plans = await m.get_plans_by_ids([int(i) for i in ids[:5]])
    if len(plans) < 2:
        raise HPError("Could not load plans to compare", 404, "not_found")

    # AI pick: highest coverage / premium efficiency
    best = max(
        plans,
        key=lambda p: (float(p["coverageAmount"]) + 1) / (float(p["monthlyPremium"]) + 1),
    )
    return _ok(
        {
            "plans": plans,
            "aiRecommendation": {
                "planId": best["id"],
                "planName": best["name"],
                "reason": "Best coverage-to-premium ratio among selected plans.",
            },
            "columns": [
                "monthlyPremium",
                "coverageAmount",
                "cashlessHospitals",
                "waitingPeriodDays",
                "claimRatio",
                "roomRent",
                "criticalIllness",
                "maternity",
                "dental",
                "vision",
            ],
        }
    )


async def check_eligibility(body: dict[str, Any]) -> dict[str, Any]:
    age = int(body.get("age") or 0)
    income = float(body.get("monthlyIncome") or body.get("income") or 0)
    student = bool(body.get("student"))
    corporate = bool(body.get("corporate") or body.get("employerInsurance"))
    state = (body.get("state") or body.get("city") or "").strip()

    results = []

    # Ayushman / PMJAY — simplified heuristic (not official)
    pmjay_ok = income > 0 and income <= 25000 and age >= 0
    results.append(
        {
            "scheme": "Ayushman Bharat / PMJAY",
            "eligible": pmjay_ok,
            "reason": (
                "Income profile may qualify for government coverage — verify on official PMJAY portal."
                if pmjay_ok
                else "Based on income inputs, verify eligibility on the official PMJAY portal."
            ),
        }
    )
    results.append(
        {
            "scheme": "Student Insurance",
            "eligible": student and age <= 30,
            "reason": "Campus / student plans usually require active enrollment under age 30.",
        }
    )
    results.append(
        {
            "scheme": "Corporate Insurance",
            "eligible": corporate,
            "reason": (
                "Employer group cover indicated — check HR for sum insured and dependents."
                if corporate
                else "No employer cover indicated."
            ),
        }
    )
    results.append(
        {
            "scheme": "State Health Scheme",
            "eligible": bool(state),
            "reason": (
                f"Check {state} state health insurance portal for domicile-based schemes."
                if state
                else "Provide state/city to evaluate state schemes."
            ),
        }
    )

    return _ok({"results": results, "disclaimer": "Informational only — not an official eligibility decision."})


# ---------- Policy analyze ----------
def _fallback_policy_summary(file_name: Optional[str]) -> tuple[dict, str]:
    summary = {
        "covered": ["Hospitalization", "Daycare procedures", "Ambulance (limits apply)"],
        "notCovered": ["Cosmetic procedures", "Self-inflicted injuries", "War / nuclear"],
        "waitingPeriod": "30 days initial; PED typically 24–48 months",
        "maximumClaim": "As per sum insured",
        "roomRent": "Check policy schedule",
        "coPay": "May apply for senior citizens / specific cities",
        "deductibles": "Usually nil on base retail plans",
        "criticalIllness": "Rider dependent",
        "dental": "Usually excluded unless add-on",
        "vision": "Usually excluded unless add-on",
        "maternity": "Waiting period often 9–24 months if covered",
    }
    explanation = (
        f"We reviewed your uploaded document{' (' + file_name + ')' if file_name else ''}. "
        "This is a structured educational summary — confirm every clause in the official policy wording "
        "or with your insurer before making claim or purchase decisions."
    )
    return summary, explanation


async def analyze_policy(
    user_id: int,
    *,
    file_url: str,
    public_id: Optional[str],
    file_name: Optional[str],
) -> dict[str, Any]:
    summary, explanation = _fallback_policy_summary(file_name)
    try:
        from app.services import mistral_service

        prompt = (
            "Summarize a typical Indian health insurance policy for a patient app. "
            f"Filename hint: {file_name}. "
            "Return JSON keys: covered (list), notCovered (list), waitingPeriod, maximumClaim, "
            "roomRent, coPay, deductibles, criticalIllness, dental, vision, maternity, plainExplanation. "
            "Keep lists short. No markdown."
        )
        raw = await mistral_service.generate_structured_response(prompt)
        if isinstance(raw, str):
            try:
                parsed = json.loads(raw)
            except Exception:
                parsed = None
        elif isinstance(raw, dict):
            parsed = raw
        else:
            parsed = None
        if isinstance(parsed, dict):
            explanation = parsed.pop("plainExplanation", explanation) or explanation
            for k in summary:
                if k in parsed:
                    summary[k] = parsed[k]
    except Exception as exc:
        log.warning("policy analyze AI fallback: %s", exc)

    saved = await m.save_policy_upload(
        user_id, file_url, public_id, file_name, summary, explanation
    )
    return _ok(saved)


# ---------- Risk ----------
def compute_medical_risk(body: dict[str, Any]) -> dict[str, Any]:
    age = int(body.get("age") or 30)
    bmi = float(body.get("bmi") or 22)
    bp = str(body.get("bloodPressure") or "normal").lower()
    sugar = str(body.get("sugar") or "normal").lower()
    family_hx = bool(body.get("familyHistory"))
    smoking = bool(body.get("smoking"))
    exercise = str(body.get("exercise") or "moderate").lower()
    sleep = float(body.get("sleepHours") or 7)

    pts = 20
    if age >= 50:
        pts += 20
    elif age >= 40:
        pts += 10
    if bmi >= 30:
        pts += 20
    elif bmi >= 25:
        pts += 10
    if "high" in bp or bp in ("hypertension", "elevated"):
        pts += 15
    if "high" in sugar or sugar in ("diabetic", "diabetes"):
        pts += 15
    if family_hx:
        pts += 10
    if smoking:
        pts += 15
    if exercise in ("none", "sedentary", "low"):
        pts += 10
    if sleep < 6:
        pts += 8

    pts = min(100, pts)
    if pts >= 60:
        level = "High"
    elif pts >= 35:
        level = "Medium"
    else:
        level = "Low"

    recs = []
    if smoking:
        recs.append("Quit smoking — major risk and premium impact.")
    if bmi >= 25:
        recs.append("Work toward a healthy BMI with diet and activity.")
    if exercise in ("none", "sedentary", "low"):
        recs.append("Aim for 150 minutes of moderate exercise weekly.")
    if sleep < 6:
        recs.append("Target 7–8 hours of sleep.")
    if family_hx or pts >= 35:
        recs.append("Schedule preventive labs and discuss critical illness cover.")
    if not recs:
        recs.append("Maintain current lifestyle and annual checkups.")

    return {
        "level": level,
        "score": pts,
        "inputs": body,
        "recommendations": recs,
    }


async def risk_score(user_id: int, body: dict[str, Any]) -> dict[str, Any]:
    result = compute_medical_risk(body or {})
    saved = await m.save_risk(
        user_id,
        result["level"],
        result["score"],
        result["inputs"],
        result["recommendations"],
    )
    return _ok(saved)


# ---------- Chat ----------
async def chat(user_id: int, message: str) -> dict[str, Any]:
    text = (message or "").strip()
    if len(text) < 2:
        raise HPError("Message too short", 400, "validation_error")
    if len(text) > 2000:
        raise HPError("Message too long", 400, "validation_error")

    from app.services.ai import memory as ai_memory
    from app.services.ai import provider as ai_provider
    from app.services.ai.safety import safety_block

    if not await ai_memory.rate_limit_ok(user_id, limit=20):
        raise HPError("Too many messages. Please wait a minute.", 429, "rate_limited")

    blocked = safety_block(text)
    if blocked:
        reply = blocked.get("reply") or blocked.get("message")
        await m.add_chat(user_id, "user", text)
        await m.add_chat(user_id, "assistant", str(reply))
        return _ok({"reply": reply, "disclaimer": blocked.get("disclaimer")})

    await m.add_chat(user_id, "user", text)

    policies = await m.list_user_policies(user_id)
    active = next((p for p in policies if p.get("status") == "active"), None)
    # Minimize policy context before sending it to the external provider.
    safe_policy = None
    if active:
        safe_policy = {
            "companyName": active.get("companyName"),
            "planName": active.get("planName"),
            "coverageAmount": active.get("coverageAmount"),
            "expiresAt": active.get("expiresAt"),
            "status": active.get("status"),
        }
    context = {
        "policy": safe_policy,
        "catalogHint": "Star, HDFC ERGO, Care, Niva Bupa, ICICI Lombard curated plans",
    }

    reply = None
    try:
        history = await m.chat_history(user_id, limit=10)
        generated = await ai_provider.complete_text(
            system_prompt=(
                "You are MEDCLUES Insurance Assistant. Answer briefly and clearly. "
                "Never guarantee coverage, claim approval, or treatment. Explain that "
                "the policy wording and insurer decision are authoritative."
            ),
            user_message=text,
            history=history[:-1],
            grounding=json.dumps(context, default=str),
        )
        if generated.success:
            reply = generated.content
    except Exception as exc:
        log.warning("chat AI fallback: %s", exc)

    if not reply:
        lower = text.lower()
        if "mri" in lower:
            reply = (
                "MRI is often covered when medically necessary during hospitalization or as "
                "specified daycare diagnostics — confirm with your policy schedule and pre-auth."
            )
        elif "surgery" in lower or "claim" in lower:
            reply = (
                "For surgery, use cashless pre-authorization at a network hospital when possible. "
                "Keep bills, discharge summary, and prescriptions for reimbursement claims."
            )
        elif "coverage" in lower or "how much" in lower:
            if active:
                reply = (
                    f"Your active policy shows about ₹{active.get('coverageAmount') or 0:,.0f} "
                    f"sum insured with {active.get('companyName') or 'your insurer'}."
                )
            else:
                reply = "No active policy on file — add a policy or run AI Recommendations."
        else:
            reply = (
                "I can help with coverage questions, claim steps, and plan comparisons. "
                "Try: “Does my insurance cover MRI?” or open AI Recommendations."
            )

    await m.add_chat(user_id, "assistant", str(reply))
    return _ok({"reply": reply})


# ---------- Expenses / charts ----------
async def expense_charts(user_id: int) -> dict[str, Any]:
    items = await m.list_expenses(user_id, limit=500)
    by_cat: dict[str, float] = {}
    by_month: dict[str, float] = {}
    year_total = 0.0
    month_total = 0.0
    today = date.today()
    for e in items:
        cat = e["category"]
        amt = float(e["amount"])
        by_cat[cat] = by_cat.get(cat, 0) + amt
        spent = e.get("spentAt") or ""
        key = str(spent)[:7]
        by_month[key] = by_month.get(key, 0) + amt
        try:
            d = date.fromisoformat(str(spent)[:10])
            if d.year == today.year:
                year_total += amt
            if d.year == today.year and d.month == today.month:
                month_total += amt
        except Exception:
            year_total += amt

    return _ok(
        {
            "monthlyTotal": round(month_total, 2),
            "yearlyTotal": round(year_total, 2),
            "pie": [{"category": k, "amount": round(v, 2)} for k, v in by_cat.items()],
            "bar": [{"month": k, "amount": round(v, 2)} for k, v in sorted(by_month.items())],
            "savingsHint": (
                "Track claims reimbursements as negative offsets in notes, "
                "and prefer cashless network hospitals to reduce out-of-pocket spend."
            ),
        }
    )


# ---------- Analytics ----------
async def analytics_summary(user_id: int) -> dict[str, Any]:
    charts = (await expense_charts(user_id))["data"]
    claims = await m.list_claims(user_id)
    submitted = [c for c in claims if c["status"] not in ("draft",)]
    approved = [c for c in claims if c["status"] == "approved"]
    success = (len(approved) / len(submitted) * 100) if submitted else 0.0
    policies = await m.list_user_policies(user_id)
    coverage = sum(float(p.get("coverageAmount") or 0) for p in policies if p.get("status") == "active")
    claimed = sum(float(c.get("amountClaimed") or 0) for c in claims)
    util = (claimed / coverage * 100) if coverage else 0.0
    trend = await m.score_history(user_id, limit=12)
    return _ok(
        {
            "healthSpending": {
                "monthly": charts["monthlyTotal"],
                "yearly": charts["yearlyTotal"],
            },
            "claimSuccessRate": round(success, 1),
            "coverageUtilization": round(util, 1),
            "protectionScoreTrend": list(reversed(trend)),
            "monthlyExpenses": charts["bar"],
        }
    )


# ---------- Renewal reminder ----------
async def renewal_remind(user_id: int) -> dict[str, Any]:
    policies = await m.list_user_policies(user_id)
    active = next((p for p in policies if p.get("status") == "active"), None)
    if not active or not active.get("expiresAt"):
        raise HPError("No active policy with expiry date", 404, "not_found")
    exp = date.fromisoformat(str(active["expiresAt"])[:10])
    days = (exp - date.today()).days
    payload = {
        "policyNumber": active.get("policyNumber"),
        "expiresAt": active.get("expiresAt"),
        "daysRemaining": days,
    }
    await m.log_notification(user_id, "policy_renewal", payload)
    try:
        from app.services import fcm_service

        await fcm_service.send_to_user(
            user_id,
            title="Policy renewal reminder",
            body=f"Your policy renews in {days} days. Tap to review Health Protection.",
            data={"type": "policy_renewal", "days": str(days)},
        )
    except Exception as exc:
        log.warning("renewal FCM skipped: %s", exc)
    return _ok({"message": "Reminder recorded", **payload})


# ---------- Emergency PDF ----------
def build_emergency_card_pdf(card: dict[str, Any], user_name: str = "Patient") -> bytes:
    """Minimal PDF without external deps (PDF 1.4 text)."""
    lines = [
        "MEDCLUES Emergency Insurance Card",
        f"Name: {user_name}",
        f"Blood Group: {card.get('bloodGroup') or '—'}",
        f"Policy: {card.get('policyNumber') or '—'}",
        f"Insurer: {card.get('company') or '—'}",
        f"Coverage: {card.get('coverage') or '—'}",
        f"Emergency: {card.get('emergencyContactName') or '—'} {card.get('emergencyContactPhone') or ''}",
        f"QR: {card.get('qrPayload') or '—'}",
    ]
    content_lines = []
    y = 750
    for line in lines:
        safe = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        content_lines.append(f"BT /F1 12 Tf 50 {y} Td ({safe}) Tj ET")
        y -= 24
    stream = "\n".join(content_lines).encode("latin-1", errors="replace")

    objects = []
    objects.append(b"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n")
    objects.append(b"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n")
    objects.append(
        b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n"
    )
    objects.append(
        f"4 0 obj<< /Length {len(stream)} >>stream\n".encode() + stream + b"\nendstream\nendobj\n"
    )
    objects.append(b"5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n")

    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(out.tell())
        out.write(obj)
    xref_pos = out.tell()
    out.write(f"xref\n0 {len(offsets)}\n".encode())
    out.write(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.write(f"{off:010d} 00000 n \n".encode())
    out.write(
        f"trailer<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode()
    )
    return out.getvalue()
