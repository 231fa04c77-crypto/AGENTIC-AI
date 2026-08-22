"""RAG knowledge retrieval — FTS/ILIKE on ai_knowledge_chunks (+ static FAQ). No fine-tuning."""
from __future__ import annotations

from typing import Any

from app.services.ai.constants import DISCLAIMER
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_STATIC = [
    {
        "title": "Book an appointment",
        "body": "Open Find Doctors, choose specialty/doctor and a slot, then confirm. Pay at clinic or online if enabled.",
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
        "title": "Emergency",
        "body": "For life-threatening symptoms seek emergency care immediately. MedClues can help you find hospitals but does not replace emergency services.",
        "category": "safety",
    },
    {
        "title": "Complaints",
        "body": "Describe your issue to the AI Assistant to create a support ticket (delivery, billing, booking). You will receive a ticket ID to track status.",
        "category": "support",
    },
]


async def retrieve(query: str, *, limit: int = 5, hospital_id: int | None = None) -> dict[str, Any]:
    """Retrieve grounding documents. Never invent clinical facts."""
    q = (query or "").strip()
    docs: list[dict] = []

    # 1) DB chunks when table exists
    try:
        from app.config.db import db

        if db.pool:
            rows = await db.fetch(
                """
                SELECT id, title, body, category, source
                FROM ai_knowledge_chunks
                WHERE (
                    title ILIKE $1 OR body ILIKE $1 OR COALESCE(tags,'') ILIKE $1
                )
                AND (hospital_id IS NULL OR hospital_id = $2 OR $2 IS NULL)
                AND COALESCE(is_active, true) = true
                ORDER BY updated_at DESC NULLS LAST
                LIMIT $3
                """,
                f"%{q[:80]}%",
                hospital_id,
                limit,
            )
            for r in rows or []:
                docs.append(
                    {
                        "id": r.get("id"),
                        "title": r.get("title"),
                        "body": r.get("body"),
                        "category": r.get("category"),
                        "source": r.get("source") or "knowledge",
                    }
                )
    except Exception as exc:
        log.debug("rag db retrieve skip: %s", type(exc).__name__)

    # 2) Static fallback / supplement
    ql = q.lower()
    for s in _STATIC:
        if any(w in (s["title"] + s["body"]).lower() for w in ql.split() if len(w) > 2) or not docs:
            docs.append({**s, "source": "static_faq"})
        if len(docs) >= limit:
            break

    # de-dupe by title
    seen = set()
    uniq = []
    for d in docs:
        t = (d.get("title") or "").lower()
        if t in seen:
            continue
        seen.add(t)
        uniq.append(d)
        if len(uniq) >= limit:
            break

    return {
        "success": True,
        "documents": uniq,
        "query": q,
        "disclaimer": DISCLAIMER,
        "grounded": bool(uniq),
    }


def format_answer(docs: list[dict]) -> str:
    if not docs:
        return (
            "I don’t have a grounded answer for that. Try Help Center, Medical Community, "
            "or book an appointment with a doctor. I won’t invent clinical advice."
        )
    parts = []
    for d in docs[:3]:
        parts.append(f"{d.get('title')}: {d.get('body')}")
    return " ".join(parts) + " (Grounded from MedClues knowledge — not a diagnosis.)"
