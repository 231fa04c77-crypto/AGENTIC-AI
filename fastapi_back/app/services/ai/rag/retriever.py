"""RAG knowledge retrieval — token/FTS ranking + Redis cache. No fine-tuning."""
from __future__ import annotations

import hashlib
import json
import re
from typing import Any

from app.services.ai.constants import DISCLAIMER
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_STOP_WORDS = {
    "the", "and", "for", "with", "how", "what", "where", "when", "does",
    "have", "this", "that", "from", "your", "you", "can", "please", "about",
}

_STATIC = [
    {
        "title": "Book an appointment",
        "body": "Open Find Doctors, choose specialty/doctor and a slot, then confirm. Pay at clinic or online if enabled.",
        "category": "appointments",
    },
    {
        "title": "Cancel or reschedule",
        "body": "Ask the assistant to cancel or reschedule, pick the appointment, and confirm. Grace reschedule for paid visits is reviewed by reception.",
        "category": "appointments",
    },
    {
        "title": "Live queue",
        "body": "Open My Appointments → today’s visit to see token / live queue status.",
        "category": "appointments",
    },
    {
        "title": "Pharmacy orders",
        "body": "After consultation, open Pharmacy to order from the hospital’s mapped PharmaSync pharmacy. Track orders under Pharmacy → Orders.",
        "category": "pharmacy",
    },
    {
        "title": "Lab tests",
        "body": "Open Laboratory to find tests, preparation notes, and book available slots.",
        "category": "laboratory",
    },
    {
        "title": "Medical Community",
        "body": "Search verified doctor answers in Medical Community. This is not a personal diagnosis. You can ask a new question or book the answering doctor.",
        "category": "community",
    },
    {
        "title": "Payments",
        "body": "Open Payments or Payment History for online consultation fees, pharmacy bills, and pending invoices. Advance payment may be required for some accounts.",
        "category": "payments",
    },
    {
        "title": "Emergency",
        "body": "For life-threatening symptoms seek emergency care immediately. MedClues can help you find hospitals but does not replace emergency services.",
        "category": "safety",
    },
    {
        "title": "Complaints",
        "body": "Describe your issue to the AI Assistant to create a support ticket (delivery, billing, booking). You will receive a ticket ID to track status.",
        "category": "support",
    },
    {
        "title": "What is diabetes",
        "body": "Diabetes means blood sugar stays higher than normal. Only a doctor can diagnose it. MedClues can help you book a General Physician.",
        "category": "disease_faq",
    },
    {
        "title": "Paracetamol uses",
        "body": "Paracetamol is commonly used for fever and mild pain. Follow label or doctor advice. Not a personal prescription.",
        "category": "medicine_info",
    },
    {
        "title": "Stress and sleep wellness",
        "body": "Regular sleep schedule, less screen time before bed, and relaxation may help. Ongoing problems deserve professional care.",
        "category": "wellness",
    },
    {
        "title": "Fever body pain sore throat guidance",
        "body": "Often linked to common viral illnesses; rest and fluids help. Seek urgent care for severe symptoms. A GP visit is reasonable if symptoms persist.",
        "category": "symptom_literacy",
    },
    {
        "title": "Fever overview",
        "body": "Fever is a raised temperature, often from infection. Rest and fluids help mild cases; seek urgent care for severe warning signs.",
        "category": "disease_faq",
    },
    {
        "title": "What is anemia",
        "body": "Anemia relates to low red cells or hemoglobin. Only labs and a clinician confirm it. Book a General Physician on MedClues.",
        "category": "disease_faq",
    },
    {
        "title": "Dengue overview",
        "body": "Dengue is mosquito-borne; fever and body pain are common. Warning signs need urgent care. Only a clinician confirms diagnosis.",
        "category": "disease_faq",
    },
    {
        "title": "High blood pressure overview",
        "body": "Hypertension is diagnosed with repeated measurements. Lifestyle and prescribed medicines may help — ask a clinician.",
        "category": "disease_faq",
    },
    {
        "title": "CBC report basics",
        "body": "CBC checks blood cell counts. Interpret results with a doctor using lab reference ranges.",
        "category": "lab_literacy",
    },
]


EDU_CATEGORIES = frozenset({
    "disease_faq",
    "medicine_info",
    "wellness",
    "symptom_literacy",
    "lab_literacy",
})


def _cache_key(query: str, hospital_id: int | None, limit: int, categories: tuple[str, ...] | None) -> str:
    cat = ",".join(categories or ())
    digest = hashlib.sha256(f"{query.lower().strip()}|{hospital_id}|{limit}|{cat}".encode()).hexdigest()[:24]
    return f"ai:rag:{digest}"


async def retrieve(
    query: str,
    *,
    limit: int = 5,
    hospital_id: int | None = None,
    categories: list[str] | None = None,
) -> dict[str, Any]:
    """Retrieve grounding documents. Never invent clinical facts."""
    q = (query or "").strip()
    cat_filter = tuple(sorted({c for c in (categories or []) if c})) or None
    tokens = {
        token
        for token in re.findall(r"[a-z0-9]+", q.lower())
        if len(token) > 2 and token not in _STOP_WORDS
    }

    try:
        from app.services.redis_client import get_redis

        r = await get_redis()
        if r and tokens:
            cached = await r.get(_cache_key(q, hospital_id, limit, cat_filter))
            if cached:
                data = json.loads(cached)
                if isinstance(data, dict):
                    data["cached"] = True
                    return data
    except Exception:
        pass

    docs: list[dict] = []
    try:
        from app.config.db import db

        if getattr(db, "pool", None):
            rows = None
            try:
                if cat_filter:
                    rows = await db.fetch_all(
                        """
                        SELECT id, title, body, category, source,
                               ts_rank(
                                 to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'') || ' ' || coalesce(tags,'')),
                                 plainto_tsquery('english', $1)
                               ) AS rank
                        FROM ai_knowledge_chunks
                        WHERE COALESCE(is_active, true) = true
                          AND (hospital_id IS NULL OR hospital_id = $2 OR $2 IS NULL)
                          AND category = ANY($4::text[])
                          AND to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'') || ' ' || coalesce(tags,''))
                              @@ plainto_tsquery('english', $1)
                        ORDER BY rank DESC, updated_at DESC NULLS LAST
                        LIMIT $3
                        """,
                        q[:200] or "help",
                        hospital_id,
                        limit,
                        list(cat_filter),
                    )
                else:
                    rows = await db.fetch_all(
                        """
                        SELECT id, title, body, category, source,
                               ts_rank(
                                 to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'') || ' ' || coalesce(tags,'')),
                                 plainto_tsquery('english', $1)
                               ) AS rank
                        FROM ai_knowledge_chunks
                        WHERE COALESCE(is_active, true) = true
                          AND (hospital_id IS NULL OR hospital_id = $2 OR $2 IS NULL)
                          AND to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'') || ' ' || coalesce(tags,''))
                              @@ plainto_tsquery('english', $1)
                        ORDER BY rank DESC, updated_at DESC NULLS LAST
                        LIMIT $3
                        """,
                        q[:200] or "help",
                        hospital_id,
                        limit,
                    )
            except Exception:
                rows = await db.fetch_all(
                    """
                    SELECT id, title, body, category, source
                    FROM ai_knowledge_chunks
                    WHERE (hospital_id IS NULL OR hospital_id = $1 OR $1 IS NULL)
                      AND COALESCE(is_active, true) = true
                    ORDER BY updated_at DESC NULLS LAST
                    LIMIT 200
                    """,
                    hospital_id,
                )
            for r in rows or []:
                if cat_filter and (r.get("category") or "") not in cat_filter:
                    continue
                item = {
                    "id": r.get("id"),
                    "title": r.get("title"),
                    "body": r.get("body"),
                    "category": r.get("category"),
                    "source": r.get("source") or "knowledge",
                }
                if "rank" in r and r.get("rank") is not None:
                    item["_score"] = float(r["rank"]) * 10
                    docs.append(item)
                else:
                    blob = f"{item['title']} {item['body']} {item['category']}".lower()
                    score = sum(
                        2 if token in str(item["title"]).lower() else 1
                        for token in tokens
                        if token in blob
                    )
                    if score:
                        item["_score"] = score
                        docs.append(item)
    except Exception as exc:
        log.debug("rag db retrieve skip: %s", type(exc).__name__)

    for s in _STATIC:
        if cat_filter and s.get("category") not in cat_filter:
            continue
        blob = (s["title"] + " " + s["body"]).lower()
        score = sum(2 if token in s["title"].lower() else 1 for token in tokens if token in blob)
        if score:
            docs.append({**s, "source": "static_faq", "_score": score})

    docs.sort(key=lambda item: float(item.get("_score") or 0), reverse=True)

    seen: set[str] = set()
    uniq: list[dict] = []
    for d in docs:
        t = (d.get("title") or "").lower()
        if t in seen:
            continue
        seen.add(t)
        clean = {key: value for key, value in d.items() if key != "_score"}
        uniq.append(clean)
        if len(uniq) >= limit:
            break

    payload = {
        "success": True,
        "documents": uniq,
        "query": q,
        "disclaimer": DISCLAIMER,
        "grounded": bool(uniq),
        "cached": False,
        "categories": list(cat_filter) if cat_filter else None,
    }

    try:
        from app.services.redis_client import get_redis

        r = await get_redis()
        if r and tokens:
            await r.setex(_cache_key(q, hospital_id, limit, cat_filter), 300, json.dumps(payload))
    except Exception:
        pass

    return payload


_WEAK_RETRIEVAL_CTAS = (
    "Next steps on MedClues: book a doctor, ask Medical Community, "
    "or search Pharmacy for labelled medicines. I will not invent clinical advice."
)


def format_answer(docs: list[dict]) -> str:
    if not docs:
        return (
            "I don’t have a verified article for that specific question yet. "
            + _WEAK_RETRIEVAL_CTAS
        )
    parts = [f"{d.get('title')}: {d.get('body')}" for d in docs[:3]]
    return " ".join(parts) + " (Grounded MedClues knowledge — not a diagnosis or prescription.)"


def education_actions(*, suggested_specialty: str | None = None) -> list[dict]:
    actions = [
        {"label": "Book a doctor", "message": "Book appointment", "route": "/doctors"},
        {"label": "Medical Community", "message": "Open Medical Community", "route": "/community"},
        {"label": "Search Pharmacy", "message": "Find pharmacy medicines", "route": "/pharmacy"},
    ]
    if suggested_specialty:
        actions.insert(
            0,
            {
                "label": f"Book {suggested_specialty}",
                "message": f"Book a {suggested_specialty} appointment",
            },
        )
    return actions


def education_ui(docs: list[dict], *, suggested_specialty: str | None = None) -> dict:
    """Structured card for Flutter education replies."""
    bullets = []
    title = "Health information"
    for doc in docs[:3]:
        if not bullets:
            title = str(doc.get("title") or title)
        body = str(doc.get("body") or "").strip()
        if body:
            bullets.append(body)
    if not bullets:
        title = "How I can help"
        bullets = [
            "I don’t have a verified article for that yet.",
            "I can help you book a doctor, ask Medical Community, or search Pharmacy.",
            "I won’t invent a diagnosis or personal prescription.",
        ]
    return {
        "type": "education",
        "title": title,
        "bullets": bullets,
        "disclaimer": DISCLAIMER,
        "actions": education_actions(suggested_specialty=suggested_specialty),
        "weakRetrieval": not bool(docs),
    }
