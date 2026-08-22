"""Socket.IO server — optional Redis adapter + JWT required for room joins."""
from __future__ import annotations

import socketio
from jose import jwt, JWTError

from app.config.config import settings
from app.services.token_service import verify_access_payload
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_mgr = None
_redis_url = (getattr(settings, "REDIS_URL", None) or "").strip()
if _redis_url:
    try:
        _mgr = socketio.AsyncRedisManager(_redis_url)
        log.info("Socket.IO using Redis adapter")
    except Exception as exc:
        log.warning("Socket.IO Redis adapter failed (%s) — in-process only", exc)
        _mgr = None

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    client_manager=_mgr,
)
sio_app = socketio.ASGIApp(sio)


def _extract_token(auth, environ, data=None) -> str | None:
    if isinstance(auth, dict):
        t = auth.get("token") or auth.get("accessToken")
        if t:
            return str(t)
    if isinstance(data, dict):
        t = data.get("token") or data.get("accessToken")
        if t:
            return str(t)
    qs = (environ or {}).get("QUERY_STRING") or ""
    for part in qs.split("&"):
        if part.startswith("token="):
            return part.split("=", 1)[1]
    return None


def _decode_token(token_str: str) -> dict | None:
    if not token_str:
        return None
    try:
        secret = (settings.JWT_SECRET or "").strip('"').strip("'")
        payload = jwt.decode(token_str, secret, algorithms=["HS256"])
        verify_access_payload(payload)
        return payload
    except (JWTError, Exception):
        return None


async def _require_session(sid) -> dict | None:
    try:
        session = await sio.get_session(sid)
    except Exception:
        session = None
    if session and session.get("authenticated"):
        return session
    return None


@sio.event
async def connect(sid, environ, auth=None):
    token = _extract_token(auth, environ)
    payload = _decode_token(token) if token else None
    if payload:
        await sio.save_session(
            sid,
            {
                "authenticated": True,
                "role": (payload.get("role") or "patient").lower(),
                "user_id": payload.get("id") or payload.get("userId"),
                "email": payload.get("email"),
            },
        )
        await sio.emit(
            "connection-response",
            {"status": "connected", "sid": sid, "authenticated": True},
            to=sid,
        )
    else:
        # Allow connect without token (health/legacy) but room joins will fail
        await sio.save_session(sid, {"authenticated": False})
        await sio.emit(
            "connection-response",
            {"status": "connected", "sid": sid, "authenticated": False},
            to=sid,
        )
    log.info("Socket connected sid=%s auth=%s", sid, bool(payload))


@sio.event
async def disconnect(sid):
    log.info("Socket disconnected sid=%s", sid)


@sio.event
async def message(sid, data):
    log.debug("Socket message from %s: %s", sid, data)


@sio.event
async def authenticate(sid, data):
    """Client can auth after connect: authenticate({token})."""
    token = _extract_token(None, None, data)
    payload = _decode_token(token) if token else None
    if not payload:
        await sio.emit("auth_error", {"message": "Invalid token"}, to=sid)
        return
    await sio.save_session(
        sid,
        {
            "authenticated": True,
            "role": (payload.get("role") or "patient").lower(),
            "user_id": payload.get("id") or payload.get("userId"),
            "email": payload.get("email"),
        },
    )
    await sio.emit("auth_ok", {"role": (payload.get("role") or "patient")}, to=sid)


async def emit_new_appointment(appointment_data):
    await sio.emit("new-appointment", appointment_data)


async def emit_revenue_update(revenue_data):
    await sio.emit("revenue-updated", revenue_data)


async def emit_doctor_status(doctor_data):
    await sio.emit("doctor-status-changed", doctor_data)


@sio.event
async def join_case_room(sid, data):
    session = await _require_session(sid)
    if not session:
        token = _extract_token(None, None, data)
        payload = _decode_token(token) if token else None
        if not payload:
            await sio.emit("auth_error", {"message": "Authentication required"}, to=sid)
            return
        await sio.save_session(
            sid,
            {
                "authenticated": True,
                "role": (payload.get("role") or "patient").lower(),
                "user_id": payload.get("id") or payload.get("userId"),
            },
        )
    case_id = (data or {}).get("case_id", "")
    if case_id:
        room = f"case:{case_id}"
        await sio.enter_room(sid, room)
        await sio.emit("joined_case", {"room": room, "case_id": case_id}, to=sid)


@sio.event
async def leave_case_room(sid, data):
    case_id = (data or {}).get("case_id", "")
    if case_id:
        await sio.leave_room(sid, f"case:{case_id}")


async def emit_case_location(case_public_id: str, payload: dict) -> None:
    await sio.emit("ambulance_location", payload, room=f"case:{case_public_id}")


async def emit_case_status_update(
    case_public_id: str, status: str, extra: dict | None = None
) -> None:
    await sio.emit(
        "case_status",
        {"case_id": case_public_id, "status": status, **(extra or {})},
        room=f"case:{case_public_id}",
    )


@sio.event
async def join_pharmacy_order_room(sid, data):
    session = await _require_session(sid)
    if not session:
        token = _extract_token(None, None, data)
        if not _decode_token(token or ""):
            await sio.emit("auth_error", {"message": "Authentication required"}, to=sid)
            return
    order_id = (data or {}).get("order_id") or (data or {}).get("orderId")
    if order_id:
        room = f"pharmacy_order:{order_id}"
        await sio.enter_room(sid, room)
        await sio.emit("joined_pharmacy_order", {"room": room, "order_id": order_id}, to=sid)


@sio.event
async def leave_pharmacy_order_room(sid, data):
    order_id = (data or {}).get("order_id") or (data or {}).get("orderId")
    if order_id:
        await sio.leave_room(sid, f"pharmacy_order:{order_id}")


async def emit_pharmacy_order_update(order_id, payload: dict) -> None:
    await sio.emit("pharmacy_order_status", payload, room=f"pharmacy_order:{order_id}")


@sio.event
async def join_community_room(sid, data):
    session = await _require_session(sid)
    if not session:
        token = _extract_token(None, None, data)
        payload = _decode_token(token or "")
        if not payload:
            await sio.emit("auth_error", {"message": "Authentication required"}, to=sid)
            return
        await sio.save_session(
            sid,
            {
                "authenticated": True,
                "role": (payload.get("role") or "patient").lower(),
                "user_id": payload.get("id") or payload.get("userId"),
            },
        )
    specialty = ((data or {}).get("specialty") or "general").strip().lower().replace(" ", "_")
    if not specialty:
        specialty = "general"
    room = f"community:{specialty}"
    await sio.enter_room(sid, room)
    await sio.emit("joined_community", {"room": room, "specialty": specialty}, to=sid)


@sio.event
async def leave_community_room(sid, data):
    specialty = ((data or {}).get("specialty") or "general").strip().lower().replace(" ", "_")
    await sio.leave_room(sid, f"community:{specialty}")


@sio.event
async def join_community_question_room(sid, data):
    session = await _require_session(sid)
    if not session:
        token = _extract_token(None, None, data)
        if not _decode_token(token or ""):
            await sio.emit("auth_error", {"message": "Authentication required"}, to=sid)
            return
    qid = (data or {}).get("question_id") or (data or {}).get("questionId")
    if qid:
        room = f"community:question:{qid}"
        await sio.enter_room(sid, room)
        await sio.emit(
            "joined_community_question", {"room": room, "question_id": qid}, to=sid
        )


async def emit_community_new_question(specialty: str, payload: dict) -> None:
    spec = (specialty or "general").strip().lower().replace(" ", "_") or "general"
    rooms = {f"community:{spec}", "community:general"}
    for room in rooms:
        await sio.emit("community_new_question", payload, room=room)


async def emit_community_new_answer(question_id, payload: dict) -> None:
    await sio.emit(
        "community_new_answer",
        payload,
        room=f"community:question:{question_id}",
    )


# ── Appointment / queue live rooms ────────────────────────────────────────────

@sio.event
async def join_appointment_queue_room(sid, data):
    session = await _require_session(sid)
    if not session:
        token = _extract_token(None, None, data)
        payload = _decode_token(token or "")
        if not payload:
            await sio.emit("auth_error", {"message": "Authentication required"}, to=sid)
            return
        await sio.save_session(
            sid,
            {
                "authenticated": True,
                "role": (payload.get("role") or "patient").lower(),
                "user_id": payload.get("id") or payload.get("userId"),
            },
        )
    appt_id = (data or {}).get("appointment_id") or (data or {}).get("appointmentId")
    if appt_id:
        room = f"appointment_queue:{appt_id}"
        await sio.enter_room(sid, room)
        await sio.emit(
            "joined_appointment_queue",
            {"room": room, "appointment_id": appt_id},
            to=sid,
        )


@sio.event
async def leave_appointment_queue_room(sid, data):
    appt_id = (data or {}).get("appointment_id") or (data or {}).get("appointmentId")
    if appt_id:
        await sio.leave_room(sid, f"appointment_queue:{appt_id}")


@sio.event
async def join_doctor_queue_room(sid, data):
    session = await _require_session(sid)
    if not session:
        token = _extract_token(None, None, data)
        if not _decode_token(token or ""):
            await sio.emit("auth_error", {"message": "Authentication required"}, to=sid)
            return
    doc_id = (data or {}).get("doctor_id") or (data or {}).get("doctorId")
    if doc_id:
        room = f"doctor_queue:{doc_id}"
        await sio.enter_room(sid, room)
        await sio.emit("joined_doctor_queue", {"room": room, "doctor_id": doc_id}, to=sid)


async def emit_queue_update(appointment_id, doctor_id, payload: dict) -> None:
    """Push live queue snapshot to patient appointment room + doctor queue room."""
    if appointment_id is not None:
        await sio.emit(
            "queue_updated",
            payload,
            room=f"appointment_queue:{appointment_id}",
        )
    if doctor_id is not None:
        await sio.emit(
            "doctor_queue_updated",
            payload,
            room=f"doctor_queue:{doctor_id}",
        )
