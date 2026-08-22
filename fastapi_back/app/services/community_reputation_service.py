"""Community reputation — separate from appointment trust_score."""
from __future__ import annotations

from typing import Optional

from app.config.db import db


async def get_or_create(subject_type: str, subject_id: int) -> dict:
    row = await db.fetch_row(
        """
        SELECT * FROM community_reputation
        WHERE subject_type = $1 AND subject_id = $2
        """,
        subject_type,
        subject_id,
    )
    if row:
        return dict(row)
    row = await db.fetch_row(
        """
        INSERT INTO community_reputation (subject_type, subject_id)
        VALUES ($1, $2)
        ON CONFLICT (subject_type, subject_id) DO UPDATE SET updated_at = NOW()
        RETURNING *
        """,
        subject_type,
        subject_id,
    )
    return dict(row)


async def adjust(
    subject_type: str,
    subject_id: int,
    *,
    delta: int = 0,
    helpful: int = 0,
    spam: int = 0,
    question: int = 0,
    answer: int = 0,
    resolved: int = 0,
) -> dict:
    await get_or_create(subject_type, subject_id)
    row = await db.fetch_row(
        """
        UPDATE community_reputation SET
            score = GREATEST(0, LEAST(200, score + $3)),
            helpful_count = helpful_count + $4,
            spam_flags = spam_flags + $5,
            questions_asked = questions_asked + $6,
            answers_given = answers_given + $7,
            questions_resolved = questions_resolved + $8,
            requires_moderation = CASE
                WHEN (score + $3) < 40 OR (spam_flags + $5) >= 3 THEN true
                WHEN (score + $3) >= 60 AND (spam_flags + $5) = 0 THEN false
                ELSE requires_moderation
            END,
            updated_at = NOW()
        WHERE subject_type = $1 AND subject_id = $2
        RETURNING *
        """,
        subject_type,
        subject_id,
        delta,
        helpful,
        spam,
        question,
        answer,
        resolved,
    )
    return dict(row) if row else await get_or_create(subject_type, subject_id)


async def doctor_stats(doctor_id: int) -> dict:
    await get_or_create("doctor", doctor_id)
    row = await db.fetch_row(
        """
        SELECT
            COUNT(*) FILTER (WHERE a.deleted_at IS NULL)::int AS answers,
            COUNT(DISTINCT q.id) FILTER (
                WHERE q.status = 'resolved' AND q.resolved_by_doctor_id = $1
            )::int AS resolved,
            COALESCE(SUM(a.helpful_count) FILTER (WHERE a.deleted_at IS NULL), 0)::int AS helpful,
            AVG(EXTRACT(EPOCH FROM (a.created_at - q.created_at)))
                FILTER (WHERE a.deleted_at IS NULL) AS avg_response_seconds
        FROM community_answers a
        JOIN community_questions q ON q.id = a.question_id
        WHERE a.author_doctor_id = $1 AND a.author_role = 'doctor'
        """,
        doctor_id,
    )
    avg_sec = None
    if row and row.get("avg_response_seconds") is not None:
        avg_sec = int(float(row["avg_response_seconds"]))

    answers = int((row or {}).get("answers") or 0)
    resolved = int((row or {}).get("resolved") or 0)
    helpful = int((row or {}).get("helpful") or 0)

    await db.execute(
        """
        UPDATE community_reputation
        SET avg_response_seconds = $2,
            answers_given = $3,
            questions_resolved = $4,
            helpful_count = GREATEST(helpful_count, $5),
            updated_at = NOW()
        WHERE subject_type = 'doctor' AND subject_id = $1
        """,
        doctor_id,
        avg_sec,
        answers,
        resolved,
        helpful,
    )
    rep = await get_or_create("doctor", doctor_id)
    return {
        "score": rep.get("score"),
        "answersGiven": answers,
        "questionsResolved": resolved,
        "helpfulAnswers": helpful,
        "averageResponseSeconds": avg_sec,
        "requiresModeration": bool(rep.get("requires_moderation")),
        "patientsHelped": answers,
    }


async def user_requires_moderation(user_id: int) -> bool:
    rep = await get_or_create("user", user_id)
    return bool(rep.get("requires_moderation")) or int(rep.get("score") or 100) < 40


async def active_sanction(user_id: int) -> Optional[dict]:
    row = await db.fetch_row(
        """
        SELECT * FROM community_user_sanctions
        WHERE user_id = $1
          AND sanction_type IN ('suspend', 'block')
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC
        LIMIT 1
        """,
        user_id,
    )
    return dict(row) if row else None


async def issue_sanction(
    user_id: int,
    sanction_type: str,
    reason: str,
    *,
    dean_id: int | None = None,
    days: int | None = 7,
) -> dict:
    row = await db.fetch_row(
        """
        INSERT INTO community_user_sanctions (
            user_id, sanction_type, reason, issued_by_admin, issued_by_dean_id, expires_at
        ) VALUES (
            $1, $2, $3, $4, $5,
            CASE WHEN $6::int IS NULL THEN NULL ELSE NOW() + ($6 || ' days')::interval END
        )
        RETURNING *
        """,
        user_id,
        sanction_type,
        reason,
        dean_id is None,
        dean_id,
        days,
    )
    if sanction_type in ("suspend", "block"):
        await adjust("user", user_id, delta=-30, spam=1)
    return dict(row)


async def list_ai_logs(limit: int = 50) -> list:
    return await db.query(
        """
        SELECT * FROM community_moderation_logs
        ORDER BY created_at DESC
        LIMIT $1
        """,
        limit,
    )
