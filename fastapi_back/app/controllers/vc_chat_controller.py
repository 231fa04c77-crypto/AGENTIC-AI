"""In-call chat between doctor and patient during a video consultation.

Messages are relayed through the database and both clients poll for new ones
(piggybacking on the call-status polling already running every ~2s).
"""

from app.config.db import db


def _format(row):
    d = dict(row)
    created = d.get('created_at')
    return {
        'id': d.get('id'),
        'appointmentId': d.get('appointment_id'),
        'role': d.get('sender_role'),
        'name': d.get('sender_name'),
        'text': d.get('text'),
        'at': created.isoformat() if hasattr(created, 'isoformat') else created,
    }


async def post_message(appointment_id: int, role: str, name: str, text: str):
    text = (text or '').strip()
    if not text:
        return {"success": False, "message": "Message is empty"}
    if len(text) > 2000:
        text = text[:2000]
    row = await db.fetch_row(
        """
        INSERT INTO vc_messages (appointment_id, sender_role, sender_name, text)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        """,
        int(appointment_id),
        role,
        name or ('Doctor' if role == 'doctor' else 'Patient'),
        text,
    )
    return {"success": True, "message": _format(row)}


async def get_messages(appointment_id: int, after_id: int = 0):
    rows = await db.query(
        """
        SELECT * FROM vc_messages
        WHERE appointment_id = $1 AND id > $2
        ORDER BY id ASC
        LIMIT 200
        """,
        int(appointment_id),
        int(after_id or 0),
    )
    return {"success": True, "messages": [_format(r) for r in rows]}
