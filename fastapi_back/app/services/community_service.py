"""Health Community orchestration — patient / doctor / admin."""
from __future__ import annotations

import re
from typing import Any

from app.models import community_model as cm

MIN_TITLE = 10
MIN_BODY = 30
DAILY_QUESTION_LIMIT = 1


def _serialize_question(row: dict, *, bookmarked: bool | None = None) -> dict:
    data = {
        "id": row["id"],
        "publicId": row.get("public_id"),
        "title": row["title"],
        "body": row["body"],
        "imageUrl": row.get("image_url"),
        "specialty": row.get("specialty") or "general",
        "status": row.get("status"),
        "moderationStatus": row.get("moderation_status"),
        "answerCount": row.get("answer_count") or 0,
        "viewCount": row.get("view_count") or 0,
        "bookmarkCount": row.get("bookmark_count") or 0,
        "authorName": None if row.get("is_anonymous") else row.get("author_name"),
        "isAnonymous": bool(row.get("is_anonymous")),
        "resolvedAt": row["resolved_at"].isoformat() if row.get("resolved_at") else None,
        "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
        "updatedAt": row["updated_at"].isoformat() if row.get("updated_at") else None,
        "disclaimer": cm.DISCLAIMER,
    }
    if bookmarked is not None:
        data["bookmarked"] = bookmarked
    return data


def _serialize_answer(row: dict) -> dict:
    doctor = None
    if row.get("author_role") == "doctor" and row.get("author_doctor_id"):
        doctor = {
            "id": row.get("author_doctor_id"),
            "name": row.get("doctor_name"),
            "specialty": row.get("doctor_specialty"),
            "experience": row.get("doctor_experience"),
            "hospitalName": row.get("hospital_name"),
        }
    return {
        "id": row["id"],
        "publicId": row.get("public_id"),
        "questionId": row.get("question_id"),
        "parentAnswerId": row.get("parent_answer_id"),
        "authorRole": row.get("author_role"),
        "body": row["body"],
        "recommendAppointment": bool(row.get("recommend_appointment")),
        "recommendEmergency": bool(row.get("recommend_emergency")),
        "helpfulCount": int(row.get("helpful_count") or 0),
        "doctor": doctor,
        "patientName": row.get("patient_name") if row.get("author_role") == "patient" else None,
        "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
        "updatedAt": row["updated_at"].isoformat() if row.get("updated_at") else None,
        "disclaimer": cm.DISCLAIMER,
    }


def _validate_text(title: str, body: str) -> str | None:
    title = (title or "").strip()
    body = (body or "").strip()
    if len(title) < MIN_TITLE:
        return f"Title must be at least {MIN_TITLE} characters"
    if len(body) < MIN_BODY:
        return f"Description must be at least {MIN_BODY} characters"
    if re.fullmatch(r"(.)\1{8,}", title.replace(" ", "")):
        return "Question looks like spam"
    if len(set(body.lower())) < 8 and len(body) > 40:
        return "Question looks like nonsense text"
    return None


async def categories() -> dict:
    from app.services import cache_keys as ck
    from app.services import cache_service as cache

    async def _load():
        labels = {
            "general": "No Specialty / General",
            "general_medicine": "General Medicine",
            "cardiology": "Cardiology",
            "orthopedics": "Orthopedics",
            "dermatology": "Dermatology",
            "neurology": "Neurology",
            "psychiatry": "Psychiatry",
            "gynecology": "Gynecology",
            "pediatrics": "Pediatrics",
            "ent": "ENT",
            "ophthalmology": "Ophthalmology",
            "dental": "Dental",
            "pulmonology": "Pulmonology",
            "gastroenterology": "Gastroenterology",
            "endocrinology": "Endocrinology",
            "nephrology": "Nephrology",
        }
        return {
            "success": True,
            "data": [{"id": s, "label": labels.get(s, s)} for s in cm.SPECIALTIES],
            "disclaimer": cm.DISCLAIMER,
        }

    return await cache.cache_aside(ck.community_categories(), ck.TTL_COMMUNITY_CATEGORIES, _load)


async def patient_feed(
    sort: str = "recent",
    specialty: str | None = None,
    limit: int = 30,
    offset: int = 0,
) -> dict:
    from app.services import cache_keys as ck
    from app.services import cache_service as cache

    lim = min(limit, 50)
    off = max(0, int(offset or 0))
    use_cache = sort in ("popular", "trending", "helpful") and off == 0

    async def _load():
        rows = await cm.list_feed(specialty=specialty, sort=sort, limit=lim, offset=off)
        next_offset = off + lim if len(rows) >= lim else None
        return {
            "success": True,
            "data": [_serialize_question(dict(r)) for r in rows],
            "disclaimer": cm.DISCLAIMER,
            "limit": lim,
            "offset": off,
            "nextOffset": next_offset,
            "nextCursor": next_offset,
        }

    if use_cache:
        return await cache.cache_aside(
            ck.community_trending(sort, specialty, lim),
            ck.TTL_COMMUNITY_TRENDING,
            _load,
        )
    return await _load()


async def patient_search(q: str) -> dict:
    from app.services import cache_keys as ck
    from app.services import cache_service as cache

    term = (q or "").strip()
    if len(term) < 2:
        return {"success": True, "data": [], "similar": [], "disclaimer": cm.DISCLAIMER}

    async def _load():
        rows = await cm.search_questions_fts(term, limit=20)
        return {
            "success": True,
            "data": [_serialize_question(dict(r)) for r in rows],
            "similar": [_serialize_question(dict(r)) for r in rows[:5]],
            "disclaimer": cm.DISCLAIMER,
        }

    return await cache.cache_aside(ck.search_suggest("community", term), ck.TTL_SEARCH_SUGGEST, _load)


async def _daily_limit_for(user_id: int) -> int:
    plus = await cm.get_plus_subscription(user_id)
    if plus:
        return int(plus.get("daily_question_limit") or 5)
    return DAILY_QUESTION_LIMIT


async def ask_question(user_id: int, body: dict) -> dict:
    from app.services import community_moderation_service as mod
    from app.services import community_reputation_service as rep
    from app.services import socket_service

    title = (body.get("title") or "").strip()
    desc = (body.get("body") or body.get("description") or "").strip()
    err = _validate_text(title, desc)
    if err:
        return {"success": False, "message": err}

    sanction = await rep.active_sanction(user_id)
    if sanction:
        return {
            "success": False,
            "message": "Your community posting privileges are suspended.",
            "code": "SUSPENDED",
        }

    limit = await _daily_limit_for(user_id)
    used = await cm.count_questions_today(user_id)
    if used >= limit:
        return {
            "success": False,
            "message": f"Daily limit reached ({limit}/day). Search existing answers or upgrade Community Plus.",
            "code": "DAILY_LIMIT",
            "limit": limit,
        }

    similar = await cm.search_questions_fts(title, limit=5)
    force = bool(body.get("force") or body.get("stillAsk"))
    if similar and not force:
        return {
            "success": False,
            "message": "Similar questions found. Review them or confirm to still ask.",
            "code": "SIMILAR_FOUND",
            "similar": [_serialize_question(dict(r)) for r in similar],
        }

    moderation = await mod.moderate_content(
        title, desc, target_type="question", author_user_id=user_id,
    )
    decision = moderation.get("decision") or "safe"
    if decision == "dangerous":
        await rep.adjust("user", user_id, delta=-15, spam=1)
        return {
            "success": False,
            "message": "Question rejected by moderation.",
            "code": "REJECTED",
            "reasons": moderation.get("reasons") or [],
        }

    needs_review = decision == "suspicious" or await rep.user_requires_moderation(user_id)
    mod_status = "pending_moderation" if needs_review else "published"
    specialty = body.get("specialty") or "general"

    row = await cm.create_question({
        "author_user_id": user_id,
        "title": title,
        "body": desc,
        "image_url": body.get("imageUrl") or body.get("image_url"),
        "specialty": specialty,
        "status": "new",
        "moderation_status": mod_status,
    })
    await rep.adjust("user", user_id, delta=1, question=1)

    if mod_status == "published":
        try:
            await socket_service.emit_community_new_question(
                row.get("specialty") or "general",
                {
                    "id": row["id"],
                    "publicId": row.get("public_id"),
                    "title": row["title"],
                    "specialty": row.get("specialty"),
                    "message": "New Community Question",
                },
            )
        except Exception:
            pass
        return {"success": True, "data": _serialize_question(row), "message": "Question published"}

    return {
        "success": True,
        "data": _serialize_question(row),
        "message": "Question submitted for moderator review",
        "code": "PENDING_MODERATION",
        "reasons": moderation.get("reasons") or [],
    }


async def get_question_detail(user_id: int | None, question_id: int) -> dict:
    q = await cm.get_question(question_id)
    if not q:
        return {"success": False, "message": "Question not found"}
    is_author = bool(user_id) and int(q.get("author_user_id") or 0) == int(user_id)
    if q.get("moderation_status") != "published" and not is_author:
        return {"success": False, "message": "Question not available"}
    await cm.bump_view(question_id)
    answers = await cm.list_answers(question_id)
    bookmarked = await cm.is_bookmarked(user_id, question_id) if user_id else False
    return {
        "success": True,
        "data": {
            "question": _serialize_question(q, bookmarked=bookmarked),
            "answers": [_serialize_answer(dict(a)) for a in answers],
        },
        "disclaimer": cm.DISCLAIMER,
    }


async def patient_follow_up(user_id: int, question_id: int, body: dict) -> dict:
    q = await cm.get_question(question_id)
    if not q:
        return {"success": False, "message": "Question not found"}
    if int(q["author_user_id"]) != int(user_id):
        return {"success": False, "message": "Only the author can post follow-ups"}
    if q.get("status") == "resolved":
        return {"success": False, "message": "Question is resolved"}
    text = (body.get("body") or body.get("text") or "").strip()
    if len(text) < 10:
        return {"success": False, "message": "Follow-up must be at least 10 characters"}
    ans = await cm.create_answer({
        "question_id": question_id,
        "parent_answer_id": body.get("parentAnswerId") or body.get("parent_answer_id"),
        "author_role": "patient",
        "author_user_id": user_id,
        "body": text,
    })
    await cm.increment_answer_count(question_id, set_status="follow_up")
    return {"success": True, "data": _serialize_answer(ans)}


async def my_questions(user_id: int) -> dict:
    rows = await cm.list_my_questions(user_id)
    return {"success": True, "data": [_serialize_question(dict(r)) for r in rows]}


async def bookmark(user_id: int, question_id: int) -> dict:
    q = await cm.get_question(question_id)
    if not q:
        return {"success": False, "message": "Question not found"}
    await cm.add_bookmark(user_id, question_id)
    return {"success": True, "message": "Saved"}


async def unbookmark(user_id: int, question_id: int) -> dict:
    await cm.remove_bookmark(user_id, question_id)
    return {"success": True, "message": "Removed"}


async def bookmarks(user_id: int) -> dict:
    rows = await cm.list_bookmarks(user_id)
    return {"success": True, "data": [_serialize_question(dict(r)) for r in rows]}


async def report_content(user_id: int | None, doctor_id: int | None, body: dict) -> dict:
    from app.services import community_reputation_service as rep

    target_type = (body.get("targetType") or body.get("target_type") or "question").lower()
    target_id = int(body.get("targetId") or body.get("target_id") or 0)
    reason = (body.get("reason") or "").strip()
    if target_type not in ("question", "answer") or not target_id or not reason:
        return {"success": False, "message": "targetType, targetId, and reason are required"}
    row = await cm.create_report({
        "reporter_user_id": user_id,
        "reporter_doctor_id": doctor_id,
        "target_type": target_type,
        "target_id": target_id,
        "reason": reason[:64],
        "details": body.get("details"),
    })
    # Flag author lightly when reported for spam/abuse
    if reason.lower() in ("spam", "harassment", "offensive", "advertisement"):
        if target_type == "question":
            q = await cm.get_question(target_id)
            if q:
                await rep.adjust("user", int(q["author_user_id"]), delta=-5, spam=1)
    return {"success": True, "data": {"id": row["id"]}, "message": "Report submitted"}


async def doctor_feed(doctor_id: int, mode: str = "all", limit: int = 40) -> dict:
    doc = await cm.get_doctor_profile_brief(doctor_id)
    specialty = (doc or {}).get("speciality") or "general"
    rows = await cm.list_doctor_feed(specialty, mode=mode, limit=min(limit, 60))
    return {
        "success": True,
        "data": [_serialize_question(dict(r)) for r in rows],
        "doctorSpecialty": specialty,
        "disclaimer": cm.DISCLAIMER,
    }


async def doctor_my_answers(doctor_id: int) -> dict:
    rows = await cm.list_doctor_answers(doctor_id)
    data = []
    for r in rows:
        r = dict(r)
        item = _serialize_answer(r)
        item["questionTitle"] = r.get("question_title")
        item["questionPublicId"] = r.get("question_public_id")
        item["questionId"] = r.get("question_id")
        data.append(item)
    return {"success": True, "data": data}


async def doctor_answer(doctor_id: int, question_id: int, body: dict) -> dict:
    from app.services import community_moderation_service as mod
    from app.services import community_reputation_service as rep
    from app.services import socket_service

    q = await cm.get_question(question_id)
    if not q or q.get("moderation_status") != "published":
        return {"success": False, "message": "Question not found"}
    text = (body.get("body") or body.get("answer") or "").strip()
    if len(text) < 20:
        return {"success": False, "message": "Answer must be at least 20 characters"}

    moderation = await mod.moderate_content(
        "doctor answer", text, target_type="answer", author_user_id=None,
    )
    if moderation.get("decision") == "dangerous":
        return {
            "success": False,
            "message": "Answer rejected by moderation",
            "reasons": moderation.get("reasons") or [],
        }

    ans = await cm.create_answer({
        "question_id": question_id,
        "parent_answer_id": body.get("parentAnswerId"),
        "author_role": "doctor",
        "author_doctor_id": doctor_id,
        "body": text,
        "recommend_appointment": body.get("recommendAppointment") or body.get("recommend_appointment"),
        "recommend_emergency": body.get("recommendEmergency") or body.get("recommend_emergency"),
    })
    new_status = "answered" if q.get("status") in ("new", "answered", "follow_up") else "answered"
    await cm.increment_answer_count(question_id, set_status=new_status)
    await rep.adjust("doctor", doctor_id, delta=2, answer=1)
    try:
        await socket_service.emit_community_new_answer(
            question_id,
            {"questionId": question_id, "answerId": ans["id"], "doctorId": doctor_id},
        )
    except Exception:
        pass
    return {"success": True, "data": _serialize_answer(ans), "disclaimer": cm.DISCLAIMER}


async def doctor_edit_answer(doctor_id: int, answer_id: int, body: dict) -> dict:
    text = (body.get("body") or "").strip()
    if len(text) < 20:
        return {"success": False, "message": "Answer must be at least 20 characters"}
    row = await cm.update_answer(answer_id, doctor_id, text)
    if not row:
        return {"success": False, "message": "Answer not found or not yours"}
    return {"success": True, "data": _serialize_answer(row)}


async def doctor_resolve(doctor_id: int, question_id: int) -> dict:
    from app.services import community_reputation_service as rep

    row = await cm.resolve_question(question_id, doctor_id)
    if not row:
        return {"success": False, "message": "Question not found"}
    await rep.adjust("doctor", doctor_id, delta=3, resolved=1)
    return {"success": True, "data": _serialize_question(row), "message": "Marked resolved"}


async def doctor_recategorize(doctor_id: int, question_id: int, specialty: str) -> dict:
    row = await cm.update_specialty(question_id, specialty)
    if not row:
        return {"success": False, "message": "Question not found"}
    return {"success": True, "data": _serialize_question(row)}


async def doctor_recommend(doctor_id: int, question_id: int, body: dict) -> dict:
    """Post a short system-style doctor note recommending consult or ER."""
    kind = (body.get("type") or "").lower()
    if kind == "emergency":
        text = (
            "Based on the symptoms described, please seek emergency medical care immediately "
            "(nearest ER / call emergency services). This community cannot replace urgent care."
        )
        recommend_emergency = True
        recommend_appointment = False
    else:
        text = (
            "I recommend booking a professional consultation for a proper evaluation. "
            "You can book an appointment with a verified doctor on MedClues."
        )
        recommend_emergency = False
        recommend_appointment = True
    return await doctor_answer(doctor_id, question_id, {
        "body": text,
        "recommendAppointment": recommend_appointment,
        "recommendEmergency": recommend_emergency,
    })


async def doctor_community_stats(doctor_id: int) -> dict:
    from app.services import community_reputation_service as rep
    stats = await rep.doctor_stats(doctor_id)
    return {"success": True, "data": stats, "disclaimer": cm.DISCLAIMER}


async def vote_helpful(user_id: int, answer_id: int, value: int = 1) -> dict:
    from app.services import community_reputation_service as rep

    row = await cm.vote_answer(user_id, answer_id, value)
    if not row:
        return {"success": False, "message": "Answer not found"}
    if row.get("author_doctor_id") and value > 0:
        await rep.adjust("doctor", int(row["author_doctor_id"]), delta=1, helpful=1)
    return {"success": True, "data": _serialize_answer(row)}


async def knowledge_archive(specialty: str | None = None, q: str | None = None) -> dict:
    rows = await cm.list_knowledge_archive(specialty=specialty, q=q, limit=40)
    return {
        "success": True,
        "data": [_serialize_question(dict(r)) for r in rows],
        "disclaimer": cm.DISCLAIMER,
    }


async def plus_status(user_id: int) -> dict:
    plus = await cm.get_plus_subscription(user_id)
    limit = await _daily_limit_for(user_id)
    used = await cm.count_questions_today(user_id)
    return {
        "success": True,
        "data": {
            "isPlus": bool(plus),
            "dailyLimit": limit,
            "usedToday": used,
            "remainingToday": max(0, limit - used),
            "endsAt": plus["ends_at"].isoformat() if plus and plus.get("ends_at") else None,
        },
    }


async def activate_plus(user_id: int, days: int = 30) -> dict:
    """Dev/admin-friendly activation — wire to payments later."""
    row = await cm.upsert_plus(user_id, daily_limit=5, days=days)
    return {
        "success": True,
        "message": "Community Plus activated",
        "data": {
            "dailyLimit": row.get("daily_question_limit"),
            "endsAt": row["ends_at"].isoformat() if row.get("ends_at") else None,
        },
    }


async def run_archive_job(days: int = 90) -> dict:
    n = await cm.archive_resolved_older_than(days)
    return {"success": True, "archived": n, "olderThanDays": days}


async def admin_moderation_list() -> dict:
    from app.services import community_reputation_service as rep

    rows = await cm.list_moderation_queue()
    data = []
    for r in rows:
        r = dict(r)
        item = _serialize_question(r)
        item["openReports"] = int(r.get("open_reports") or 0)
        data.append(item)
    logs = await rep.list_ai_logs(limit=30)
    return {
        "success": True,
        "data": data,
        "aiLogs": [
            {
                "id": l["id"],
                "targetType": l.get("target_type"),
                "decision": l.get("decision"),
                "reasons": l.get("reasons"),
                "engine": l.get("engine"),
                "createdAt": l["created_at"].isoformat() if l.get("created_at") else None,
            }
            for l in logs
        ],
    }


async def admin_publish(question_id: int) -> dict:
    from app.services import socket_service

    row = await cm.set_moderation(question_id, "published", q_status="new")
    if not row:
        return {"success": False, "message": "Not found"}
    try:
        from app.services import cache_service as cache
        await cache.invalidate_community()
    except Exception:
        pass
    try:
        await socket_service.emit_community_new_question(
            row.get("specialty") or "general",
            {
                "id": row["id"],
                "title": row["title"],
                "specialty": row.get("specialty"),
                "message": "New Community Question",
            },
        )
    except Exception:
        pass
    return {"success": True, "data": _serialize_question(row)}


async def admin_reject(question_id: int) -> dict:
    from app.services import community_reputation_service as rep

    row = await cm.set_moderation(question_id, "rejected")
    if not row:
        return {"success": False, "message": "Not found"}
    await rep.adjust("user", int(row["author_user_id"]), delta=-10, spam=1)
    return {"success": True, "data": _serialize_question(row)}


async def admin_soft_delete(question_id: int) -> dict:
    ok = await cm.soft_delete_question(question_id)
    if not ok:
        return {"success": False, "message": "Not found"}
    return {"success": True, "message": "Question hidden"}


async def admin_warn_user(user_id: int, reason: str) -> dict:
    from app.services import community_reputation_service as rep

    row = await rep.issue_sanction(user_id, "warn", reason or "Community warning", days=None)
    await rep.adjust("user", user_id, delta=-10)
    return {"success": True, "data": {"id": row["id"]}, "message": "Warning issued"}


async def admin_suspend_user(user_id: int, reason: str, days: int = 7) -> dict:
    from app.services import community_reputation_service as rep

    row = await rep.issue_sanction(user_id, "suspend", reason or "Community suspension", days=days)
    return {"success": True, "data": {"id": row["id"]}, "message": f"Suspended {days} days"}


async def dean_moderation_list(hospital_id: int) -> dict:
    rows = await cm.list_hospital_moderation(hospital_id)
    data = []
    for r in rows:
        r = dict(r)
        item = _serialize_question(r)
        item["openReports"] = int(r.get("open_reports") or 0)
        data.append(item)
    return {"success": True, "data": data}
