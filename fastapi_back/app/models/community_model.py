"""Health Community — questions, answers, bookmarks, reports."""
from __future__ import annotations

import secrets
from typing import Any, Optional

from app.config.db import db

SPECIALTIES = [
    "general",
    "general_medicine",
    "cardiology",
    "orthopedics",
    "dermatology",
    "neurology",
    "psychiatry",
    "gynecology",
    "pediatrics",
    "ent",
    "ophthalmology",
    "dental",
    "pulmonology",
    "gastroenterology",
    "endocrinology",
    "nephrology",
]

DISCLAIMER = (
    "This information is intended for general educational purposes and "
    "should not replace a professional medical consultation."
)


def _public_id(prefix: str = "CQ") -> str:
    return f"{prefix}-{secrets.token_hex(6).upper()}"


def normalize_specialty(raw: str | None) -> str:
    s = (raw or "general").strip().lower().replace("-", " ").replace("_", " ")
    s = " ".join(s.split())
    if s in ("", "none", "no specialty", "nospecialty"):
        return "general"
    aliases = {
        "general": "general",
        "general medicine": "general_medicine",
        "cardiology": "cardiology",
        "orthopedics": "orthopedics",
        "ortho": "orthopedics",
        "dermatology": "dermatology",
        "skin": "dermatology",
        "neurology": "neurology",
        "neuro": "neurology",
        "psychiatry": "psychiatry",
        "psych": "psychiatry",
        "gynecology": "gynecology",
        "gynae": "gynecology",
        "gyne": "gynecology",
        "pediatrics": "pediatrics",
        "paediatrics": "pediatrics",
        "pediatric": "pediatrics",
        "ent": "ent",
        "ophthalmology": "ophthalmology",
        "eye": "ophthalmology",
        "dental": "dental",
        "teeth": "dental",
        "pulmonology": "pulmonology",
        "lung": "pulmonology",
        "gastroenterology": "gastroenterology",
        "gastro": "gastroenterology",
        "endocrinology": "endocrinology",
        "endo": "endocrinology",
        "nephrology": "nephrology",
        "kidney": "nephrology",
        "heart": "cardiology",
    }
    key = aliases.get(s)
    if key:
        return key
    underscored = s.replace(" ", "_")
    return underscored if underscored in SPECIALTIES else "general"


async def count_questions_today(user_id: int) -> int:
    row = await db.fetch_row(
        """
        SELECT COUNT(*)::int AS c FROM community_questions
        WHERE author_user_id = $1
          AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC')
          AND deleted_at IS NULL
        """,
        user_id,
    )
    return int(row["c"]) if row else 0


async def create_question(data: dict) -> dict:
    row = await db.fetch_row(
        """
        INSERT INTO community_questions (
            public_id, author_user_id, title, body, image_url, specialty,
            status, moderation_status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
        """,
        _public_id("CQ"),
        data["author_user_id"],
        data["title"],
        data["body"],
        data.get("image_url"),
        normalize_specialty(data.get("specialty")),
        data.get("status", "new"),
        data.get("moderation_status", "published"),
    )
    return dict(row)


async def get_question(question_id: int, *, include_deleted: bool = False) -> Optional[dict]:
    sql = """
        SELECT q.*,
               u.name AS author_name
        FROM community_questions q
        LEFT JOIN users u ON u.id = q.author_user_id
        WHERE q.id = $1
    """
    if not include_deleted:
        sql += " AND q.deleted_at IS NULL"
    row = await db.fetch_row(sql, question_id)
    return dict(row) if row else None


async def bump_view(question_id: int) -> None:
    await db.execute(
        "UPDATE community_questions SET view_count = view_count + 1 WHERE id = $1",
        question_id,
    )


async def list_feed(
    *,
    specialty: str | None = None,
    status: str | None = None,
    sort: str = "recent",
    limit: int = 30,
    offset: int = 0,
    unanswered_only: bool = False,
) -> list:
    clauses = [
        "q.deleted_at IS NULL",
        "q.moderation_status = 'published'",
    ]
    params: list[Any] = []
    idx = 1
    if specialty and specialty != "all":
        clauses.append(f"q.specialty = ${idx}")
        params.append(normalize_specialty(specialty))
        idx += 1
    if status:
        clauses.append(f"q.status = ${idx}")
        params.append(status)
        idx += 1
    if unanswered_only:
        clauses.append("q.answer_count = 0")
        clauses.append("q.status IN ('new','follow_up')")

    order = "q.created_at DESC"
    if sort == "popular":
        order = "q.answer_count DESC, q.view_count DESC, q.created_at DESC"
    elif sort == "unanswered":
        order = "q.created_at ASC"

    params.extend([limit, offset])
    sql = f"""
        SELECT q.*, u.name AS author_name
        FROM community_questions q
        LEFT JOIN users u ON u.id = q.author_user_id
        WHERE {' AND '.join(clauses)}
        ORDER BY {order}
        LIMIT ${idx} OFFSET ${idx + 1}
    """
    return await db.query(sql, *params)


async def search_questions(q: str, limit: int = 20) -> list:
    term = (q or "").strip()
    if len(term) < 2:
        return []
    like = f"%{term}%"
    return await db.query(
        """
        SELECT q.*, u.name AS author_name
        FROM community_questions q
        LEFT JOIN users u ON u.id = q.author_user_id
        WHERE q.deleted_at IS NULL
          AND q.moderation_status = 'published'
          AND (q.title ILIKE $1 OR q.body ILIKE $1)
        ORDER BY
          CASE WHEN q.title ILIKE $1 THEN 0 ELSE 1 END,
          q.answer_count DESC,
          q.created_at DESC
        LIMIT $2
        """,
        like,
        limit,
    )


async def list_my_questions(user_id: int, limit: int = 50) -> list:
    return await db.query(
        """
        SELECT q.* FROM community_questions q
        WHERE q.author_user_id = $1 AND q.deleted_at IS NULL
        ORDER BY q.created_at DESC
        LIMIT $2
        """,
        user_id,
        limit,
    )


async def list_doctor_feed(
    specialty: str,
    *,
    mode: str = "all",
    limit: int = 40,
    offset: int = 0,
) -> list:
    """mode: all | unanswered | specialty | general | resolved"""
    clauses = [
        "q.deleted_at IS NULL",
        "q.moderation_status = 'published'",
    ]
    params: list[Any] = []
    idx = 1
    spec = normalize_specialty(specialty)

    if mode == "general":
        clauses.append("q.specialty = 'general'")
    elif mode == "specialty":
        clauses.append(f"q.specialty = ${idx}")
        params.append(spec)
        idx += 1
    elif mode == "resolved":
        clauses.append("q.status = 'resolved'")
        clauses.append(f"(q.specialty = ${idx} OR q.specialty = 'general')")
        params.append(spec)
        idx += 1
    else:
        # all / unanswered — own specialty + general
        clauses.append(f"(q.specialty = ${idx} OR q.specialty = 'general')")
        params.append(spec)
        idx += 1
        if mode == "unanswered":
            clauses.append("q.answer_count = 0")

    order = "q.created_at DESC"
    if mode == "unanswered":
        order = "q.created_at ASC"

    params.extend([limit, offset])
    sql = f"""
        SELECT q.*, u.name AS author_name
        FROM community_questions q
        LEFT JOIN users u ON u.id = q.author_user_id
        WHERE {' AND '.join(clauses)}
        ORDER BY {order}
        LIMIT ${idx} OFFSET ${idx + 1}
    """
    return await db.query(sql, *params)


async def create_answer(data: dict) -> dict:
    row = await db.fetch_row(
        """
        INSERT INTO community_answers (
            public_id, question_id, parent_answer_id, author_role,
            author_user_id, author_doctor_id, body,
            recommend_appointment, recommend_emergency
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
        """,
        _public_id("CA"),
        data["question_id"],
        data.get("parent_answer_id"),
        data["author_role"],
        data.get("author_user_id"),
        data.get("author_doctor_id"),
        data["body"],
        bool(data.get("recommend_appointment")),
        bool(data.get("recommend_emergency")),
    )
    return dict(row)


async def update_answer(answer_id: int, doctor_id: int, body: str) -> Optional[dict]:
    row = await db.fetch_row(
        """
        UPDATE community_answers
        SET body = $1, updated_at = NOW()
        WHERE id = $2 AND author_doctor_id = $3 AND deleted_at IS NULL
        RETURNING *
        """,
        body,
        answer_id,
        doctor_id,
    )
    return dict(row) if row else None


async def list_answers(question_id: int) -> list:
    return await db.query(
        """
        SELECT a.*,
               d.name AS doctor_name,
               d.speciality AS doctor_specialty,
               d.experience AS doctor_experience,
               h.name AS hospital_name,
               u.name AS patient_name
        FROM community_answers a
        LEFT JOIN doctors d ON d.id = a.author_doctor_id
        LEFT JOIN hospital_tieups h ON h.id = d.hospital_id
        LEFT JOIN users u ON u.id = a.author_user_id
        WHERE a.question_id = $1 AND a.deleted_at IS NULL
        ORDER BY a.created_at ASC
        """,
        question_id,
    )


async def list_doctor_answers(doctor_id: int, limit: int = 50) -> list:
    return await db.query(
        """
        SELECT a.*, q.title AS question_title, q.public_id AS question_public_id, q.id AS question_id
        FROM community_answers a
        JOIN community_questions q ON q.id = a.question_id
        WHERE a.author_doctor_id = $1 AND a.deleted_at IS NULL AND q.deleted_at IS NULL
        ORDER BY a.created_at DESC
        LIMIT $2
        """,
        doctor_id,
        limit,
    )


async def increment_answer_count(question_id: int, *, set_status: str | None = None) -> None:
    if set_status:
        await db.execute(
            """
            UPDATE community_questions
            SET answer_count = answer_count + 1,
                status = $2,
                updated_at = NOW()
            WHERE id = $1
            """,
            question_id,
            set_status,
        )
    else:
        await db.execute(
            """
            UPDATE community_questions
            SET answer_count = answer_count + 1, updated_at = NOW()
            WHERE id = $1
            """,
            question_id,
        )


async def resolve_question(question_id: int, doctor_id: int) -> Optional[dict]:
    row = await db.fetch_row(
        """
        UPDATE community_questions
        SET status = 'resolved',
            resolved_at = NOW(),
            resolved_by_doctor_id = $2,
            updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
        """,
        question_id,
        doctor_id,
    )
    return dict(row) if row else None


async def update_specialty(question_id: int, specialty: str) -> Optional[dict]:
    row = await db.fetch_row(
        """
        UPDATE community_questions
        SET specialty = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
        """,
        question_id,
        normalize_specialty(specialty),
    )
    return dict(row) if row else None


async def soft_delete_question(question_id: int) -> bool:
    result = await db.execute(
        """
        UPDATE community_questions
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        """,
        question_id,
    )
    return result == "UPDATE 1"


async def set_moderation(question_id: int, status: str, *, q_status: str | None = None) -> Optional[dict]:
    if q_status:
        row = await db.fetch_row(
            """
            UPDATE community_questions
            SET moderation_status = $2, status = $3, updated_at = NOW()
            WHERE id = $1
            RETURNING *
            """,
            question_id,
            status,
            q_status,
        )
    else:
        row = await db.fetch_row(
            """
            UPDATE community_questions
            SET moderation_status = $2, updated_at = NOW()
            WHERE id = $1
            RETURNING *
            """,
            question_id,
            status,
        )
    return dict(row) if row else None


async def add_bookmark(user_id: int, question_id: int) -> None:
    await db.execute(
        """
        INSERT INTO community_bookmarks (user_id, question_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, question_id) DO NOTHING
        """,
        user_id,
        question_id,
    )
    await db.execute(
        """
        UPDATE community_questions
        SET bookmark_count = (
            SELECT COUNT(*) FROM community_bookmarks WHERE question_id = $1
        )
        WHERE id = $1
        """,
        question_id,
    )


async def remove_bookmark(user_id: int, question_id: int) -> None:
    await db.execute(
        "DELETE FROM community_bookmarks WHERE user_id = $1 AND question_id = $2",
        user_id,
        question_id,
    )
    await db.execute(
        """
        UPDATE community_questions
        SET bookmark_count = (
            SELECT COUNT(*) FROM community_bookmarks WHERE question_id = $1
        )
        WHERE id = $1
        """,
        question_id,
    )


async def list_bookmarks(user_id: int, limit: int = 50) -> list:
    return await db.query(
        """
        SELECT q.*, u.name AS author_name, b.created_at AS bookmarked_at
        FROM community_bookmarks b
        JOIN community_questions q ON q.id = b.question_id
        LEFT JOIN users u ON u.id = q.author_user_id
        WHERE b.user_id = $1 AND q.deleted_at IS NULL AND q.moderation_status = 'published'
        ORDER BY b.created_at DESC
        LIMIT $2
        """,
        user_id,
        limit,
    )


async def is_bookmarked(user_id: int, question_id: int) -> bool:
    row = await db.fetch_row(
        "SELECT 1 FROM community_bookmarks WHERE user_id = $1 AND question_id = $2",
        user_id,
        question_id,
    )
    return bool(row)


async def create_report(data: dict) -> dict:
    row = await db.fetch_row(
        """
        INSERT INTO community_reports (
            reporter_user_id, reporter_doctor_id, target_type, target_id, reason, details
        ) VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *
        """,
        data.get("reporter_user_id"),
        data.get("reporter_doctor_id"),
        data["target_type"],
        data["target_id"],
        data["reason"],
        data.get("details"),
    )
    return dict(row)


async def list_moderation_queue(limit: int = 50) -> list:
    return await db.query(
        """
        SELECT q.*, u.name AS author_name,
               (SELECT COUNT(*) FROM community_reports r
                WHERE r.target_type = 'question' AND r.target_id = q.id AND r.status = 'open') AS open_reports
        FROM community_questions q
        LEFT JOIN users u ON u.id = q.author_user_id
        WHERE q.deleted_at IS NULL
          AND (
            q.moderation_status = 'pending_moderation'
            OR EXISTS (
                SELECT 1 FROM community_reports r
                WHERE r.target_type = 'question' AND r.target_id = q.id AND r.status = 'open'
            )
          )
        ORDER BY q.created_at DESC
        LIMIT $1
        """,
        limit,
    )


async def get_doctor_profile_brief(doctor_id: int) -> Optional[dict]:
    row = await db.fetch_row(
        """
        SELECT d.id, d.name, d.speciality, d.experience, d.image,
               h.id AS hospital_id, h.name AS hospital_name
        FROM doctors d
        LEFT JOIN hospital_tieups h ON h.id = d.hospital_id
        WHERE d.id = $1
        """,
        doctor_id,
    )
    return dict(row) if row else None


async def search_questions_fts(q: str, limit: int = 20) -> list:
    term = (q or "").strip()
    if len(term) < 2:
        return []
    # Prefer FTS; fall back to ILIKE if vector missing
    try:
        rows = await db.query(
            """
            SELECT q.*, u.name AS author_name,
                   ts_rank(q.search_vector, plainto_tsquery('english', $1)) AS rank
            FROM community_questions q
            LEFT JOIN users u ON u.id = q.author_user_id
            WHERE q.deleted_at IS NULL
              AND q.moderation_status = 'published'
              AND q.archived_at IS NULL
              AND q.search_vector @@ plainto_tsquery('english', $1)
            ORDER BY rank DESC, q.answer_count DESC
            LIMIT $2
            """,
            term,
            limit,
        )
        if rows:
            return rows
    except Exception:
        pass
    return await search_questions(term, limit=limit)


async def vote_answer(user_id: int, answer_id: int, value: int = 1) -> Optional[dict]:
    value = 1 if value >= 0 else -1
    await db.execute(
        """
        INSERT INTO community_answer_votes (answer_id, user_id, value)
        VALUES ($1, $2, $3)
        ON CONFLICT (answer_id, user_id) DO UPDATE SET value = EXCLUDED.value
        """,
        answer_id,
        user_id,
        value,
    )
    row = await db.fetch_row(
        """
        UPDATE community_answers a SET
            helpful_count = (
                SELECT COALESCE(SUM(value), 0) FROM community_answer_votes v WHERE v.answer_id = a.id
            ),
            updated_at = NOW()
        WHERE a.id = $1 AND a.deleted_at IS NULL
        RETURNING *
        """,
        answer_id,
    )
    return dict(row) if row else None


async def get_plus_subscription(user_id: int) -> Optional[dict]:
    row = await db.fetch_row(
        """
        SELECT * FROM community_plus_subscriptions
        WHERE user_id = $1 AND status = 'active'
          AND (ends_at IS NULL OR ends_at > NOW())
        """,
        user_id,
    )
    return dict(row) if row else None


async def upsert_plus(user_id: int, *, daily_limit: int = 5, days: int = 30) -> dict:
    row = await db.fetch_row(
        """
        INSERT INTO community_plus_subscriptions (user_id, daily_question_limit, status, ends_at)
        VALUES ($1, $2, 'active', NOW() + ($3 || ' days')::interval)
        ON CONFLICT (user_id) DO UPDATE SET
            daily_question_limit = EXCLUDED.daily_question_limit,
            status = 'active',
            ends_at = EXCLUDED.ends_at,
            starts_at = NOW()
        RETURNING *
        """,
        user_id,
        daily_limit,
        days,
    )
    return dict(row)


async def archive_resolved_older_than(days: int = 90) -> int:
    result = await db.execute(
        """
        UPDATE community_questions
        SET status = 'archived', archived_at = NOW(), updated_at = NOW()
        WHERE deleted_at IS NULL
          AND archived_at IS NULL
          AND status = 'resolved'
          AND resolved_at IS NOT NULL
          AND resolved_at < NOW() - ($1 || ' days')::interval
        """,
        days,
    )
    # result like "UPDATE N"
    try:
        return int(str(result).split()[-1])
    except Exception:
        return 0


async def list_knowledge_archive(
    *,
    specialty: str | None = None,
    q: str | None = None,
    limit: int = 30,
) -> list:
    clauses = [
        "q.deleted_at IS NULL",
        "q.moderation_status = 'published'",
        "(q.status = 'resolved' OR q.status = 'archived' OR q.archived_at IS NOT NULL)",
    ]
    params: list = []
    idx = 1
    if specialty and specialty != "all":
        clauses.append(f"q.specialty = ${idx}")
        params.append(normalize_specialty(specialty))
        idx += 1
    if q and len(q.strip()) >= 2:
        clauses.append(
            f"(q.search_vector @@ plainto_tsquery('english', ${idx}) OR q.title ILIKE ${idx + 1})"
        )
        params.append(q.strip())
        params.append(f"%{q.strip()}%")
        idx += 2
    params.append(limit)
    sql = f"""
        SELECT q.*, u.name AS author_name
        FROM community_questions q
        LEFT JOIN users u ON u.id = q.author_user_id
        WHERE {' AND '.join(clauses)}
        ORDER BY COALESCE(q.resolved_at, q.created_at) DESC
        LIMIT ${idx}
    """
    try:
        return await db.query(sql, *params)
    except Exception:
        # fallback without FTS
        return await db.query(
            """
            SELECT q.*, u.name AS author_name
            FROM community_questions q
            LEFT JOIN users u ON u.id = q.author_user_id
            WHERE q.deleted_at IS NULL AND q.moderation_status = 'published'
              AND q.status IN ('resolved', 'archived')
            ORDER BY q.created_at DESC
            LIMIT $1
            """,
            limit,
        )


async def list_hospital_moderation(hospital_id: int, limit: int = 50) -> list:
    """Questions answered by doctors at this hospital, or pending with reports."""
    return await db.query(
        """
        SELECT DISTINCT q.*, u.name AS author_name,
               (SELECT COUNT(*) FROM community_reports r
                WHERE r.target_type = 'question' AND r.target_id = q.id AND r.status = 'open') AS open_reports
        FROM community_questions q
        LEFT JOIN users u ON u.id = q.author_user_id
        LEFT JOIN community_answers a ON a.question_id = q.id AND a.author_role = 'doctor'
        LEFT JOIN doctors d ON d.id = a.author_doctor_id
        WHERE q.deleted_at IS NULL
          AND (
            q.moderation_status = 'pending_moderation'
            OR d.hospital_id = $1
            OR EXISTS (
                SELECT 1 FROM community_reports r
                WHERE r.target_type = 'question' AND r.target_id = q.id AND r.status = 'open'
            )
          )
        ORDER BY q.created_at DESC
        LIMIT $2
        """,
        hospital_id,
        limit,
    )
