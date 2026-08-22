import asyncio
import uvicorn
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config.config import settings, validate_settings, cors_allowed_origins, cors_origin_regex
from app.utils.app_logger import get_logger

log = get_logger("medclues.api")
validate_settings()
from app.config.db import db
from contextlib import asynccontextmanager
log.info("Importing routes...")
from app.routes import (
    admin_routes, doctor_routes, user_routes, appointment_routes,
    blood_bank_routes, lab_routes, hospital_routes,
    emergency_routes, ai_routes,
    job_application_routes, otp_routes, specialty_routes,
    location_routes, dean_routes, super_appointment_routes,
    payments_routes, charts_routes, auth_routes, health_routes, reception_routes,
    link_routes,
    partner_emergency_routes, partner_admin_routes,
    dispatch_routes,
    partner_dashboard_routes,
    partner_pharmacy_routes,
    partner_lab_routes,
    user_pharmacy_routes,
    dean_pharmacy_routes,
    medicine_routes,
    health_protection_routes,
    partner_domain_stub_routes,
    user_community_routes,
    doctor_community_routes,
    admin_community_routes,
    dean_community_routes,
    search_routes,
    ops_routes,
    public_appointment_routes,
    order_routing_routes,
)
from app.middleware.request_logging import RequestLoggingMiddleware
from app.middleware.maintenance import MaintenanceModeMiddleware
from app.middleware.metrics import PrometheusMiddleware
log.info("Routes imported.")
import cloudinary
import cloudinary.uploader
import os
from fastapi.staticfiles import StaticFiles

# Cloudinary Configuration
cloudinary.config(
    cloud_name=settings.CLOUDINARY_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    log.info("Starting FastAPI application...")
    if getattr(settings, "AI_INTENT_DICTIONARY_VALIDATE_ON_START", True):
        try:
            from app.services.ai.intent.dictionary import try_validate_on_startup

            try_validate_on_startup()
        except Exception as _e:
            log.warning("Intent dictionary startup check skipped: %s", _e)
    if getattr(settings, "AI_ENTITY_DICTIONARY_VALIDATE_ON_START", True):
        try:
            from app.services.ai.entity.dictionary import try_validate_on_startup as try_entity_dict

            try_entity_dict()
        except Exception as _e:
            log.warning("Entity dictionary startup check skipped: %s", _e)
    if getattr(settings, "AI_SYNONYM_VALIDATE_ON_START", True):
        try:
            from app.services.ai.synonym import try_validate_on_startup as try_synonym

            try_synonym()
        except Exception as _e:
            log.warning("Synonym engine startup check skipped: %s", _e)
    if getattr(settings, "AI_ABBREVIATION_VALIDATE_ON_START", True):
        try:
            from app.services.ai.abbreviation import try_validate_on_startup as try_abbr

            try_abbr()
        except Exception as _e:
            log.warning("Abbreviation engine startup check skipped: %s", _e)
    if getattr(settings, "AI_SPELLING_VALIDATE_ON_START", True):
        try:
            from app.services.ai.spelling import try_validate_on_startup as try_spell

            try_spell()
        except Exception as _e:
            log.warning("Spelling engine startup check skipped: %s", _e)
    log.info("Connecting to DB in lifespan...")
    success = await db.connect()
    if not success:
        log.warning("PostgreSQL not connected — login/API will retry on first request.")
    else:
        log.info("PostgreSQL connected.")
        # Auto-create DEAN table if it doesn't exist
        try:
            from app.models import dean_model
            log.info("Preparing DEAN table...")
            await dean_model.create_deans_table()
            log.info("DEAN table ready")
        except Exception as _e:
            log.warning("Could not create deans table: %s", _e)
        try:
            from app.models import appointment_model
            await appointment_model.ensure_booking_id_column()
            log.info("Appointments booking_id column ready")
        except Exception as _e:
            log.warning("Could not ensure booking_id column: %s", _e)
        try:
            from app.models import refresh_token_model
            await refresh_token_model.ensure_refresh_tokens_table()
            log.info("Refresh tokens table ready")
        except Exception as _e:
            log.warning("Could not ensure refresh_tokens table: %s", _e)
        try:
            from app.models import payment_transaction_model
            await payment_transaction_model.ensure_payment_transactions_table()
            log.info("Payment transactions table ready")
        except Exception as _e:
            log.warning("Could not ensure payment_transactions table: %s", _e)
        try:
            from app.models import emergency_event_model
            await emergency_event_model.ensure_emergency_events_table()
            log.info("Emergency events table ready")
        except Exception as _e:
            log.warning("Could not ensure emergency_events table: %s", _e)
        try:
            from app.models import audit_log_model
            await audit_log_model.ensure_audit_logs_table()
            log.info("Audit logs table ready")
        except Exception as _e:
            log.warning("Could not ensure audit_logs table: %s", _e)
        try:
            from app.models import platform_settings_model
            await platform_settings_model.ensure_platform_settings_table()
            log.info("Platform settings table ready")
        except Exception as _e:
            log.warning("Could not ensure platform_settings table: %s", _e)
        try:
            from app.models import medicine_model
            await medicine_model.ensure_medicine_tables()
            log.info("Medicine module tables ready")
        except Exception as _e:
            log.warning("Could not ensure medicine tables: %s", _e)
        try:
            from app.models import health_protection_model
            await health_protection_model.ensure_health_protection_tables()
            log.info("Health Protection tables ready")
        except Exception as _e:
            log.warning("Could not ensure health protection tables: %s", _e)
        try:
            from app.db.migration_runner import run_pending_migrations
            applied = await run_pending_migrations()
            if applied:
                log.info("SQL migrations applied: %s", ", ".join(applied))
            else:
                log.info("SQL migrations up to date")
        except Exception as _e:
            log.warning("Could not run SQL migrations: %s", _e)
        # Background workers (skip when RUN_BACKGROUND_WORKERS_IN_API=false — use app.workers.runner)
        if settings.RUN_BACKGROUND_WORKERS_IN_API:
            try:
                from app.services.webhook_retry_worker import start_webhook_retry_worker
                asyncio.create_task(start_webhook_retry_worker())
                log.info("Webhook retry worker scheduled")
            except Exception as _e:
                log.warning("Webhook retry worker could not start: %s", _e)
            try:
                from app.services.community_archive_worker import start_community_archive_worker
                asyncio.create_task(start_community_archive_worker())
                log.info("Community archive worker scheduled")
            except Exception as _e:
                log.warning("Community archive worker could not start: %s", _e)
            try:
                from app.services.notification_outbox_worker import start_notification_outbox_worker
                asyncio.create_task(start_notification_outbox_worker())
                log.info("Notification outbox worker scheduled")
            except Exception as _e:
                log.warning("Notification outbox worker could not start: %s", _e)
            try:
                from app.services.appointment_archive_worker import start_appointment_archive_worker
                asyncio.create_task(start_appointment_archive_worker())
                log.info("Appointment archive worker scheduled")
            except Exception as _e:
                log.warning("Appointment archive worker could not start: %s", _e)
            try:
                from app.services.order_monitoring_service import start_order_monitoring_worker
                asyncio.create_task(start_order_monitoring_worker())
                log.info("Order monitoring worker scheduled")
            except Exception as _e:
                log.warning("Order monitoring worker could not start: %s", _e)
        else:
            log.info("Background workers disabled in API (RUN_BACKGROUND_WORKERS_IN_API=false)")
        try:
            from app.models import fcm_token_model
            await fcm_token_model.ensure_fcm_tokens_table()
            log.info("FCM tokens table ready")
        except Exception as _e:
            log.warning("Could not ensure fcm_tokens table: %s", _e)
        try:
            from app.models import call_session_model
            await call_session_model.ensure_call_sessions_table()
            log.info("Call sessions table ready")
        except Exception as _e:
            log.warning("Could not ensure call_sessions table: %s", _e)
        try:
            from app.models import notification_model
            await notification_model.ensure_notifications_table()
            log.info("Notifications table ready")
        except Exception as _e:
            log.warning("Could not ensure notifications table: %s", _e)
        try:
            from app.services import fcm_service
            fcm_service._ensure_firebase()
        except Exception as _e:
            log.warning("Firebase Admin init skipped: %s", _e)
        try:
            from app.models import doctor_slot_model
            from app.services import doctor_slot_service
            await doctor_slot_model.ensure_doctor_slots_schema()
            await doctor_slot_model.ensure_appointment_slot_id_column()

            async def _warm_doctor_slots():
                try:
                    await doctor_slot_service.ensure_all_doctors_scheduled()
                    log.info("Doctor slots schedule ready")
                except Exception as warm_err:
                    log.warning("Doctor slots warm-up failed: %s", warm_err)

            asyncio.create_task(_warm_doctor_slots())
            log.info("Doctor slots schema ready (schedule warming in background)")
        except Exception as _e:
            log.warning("Could not ensure doctor slots: %s", _e)
    try:
        from app.services.telegram_polling import start_telegram_bot
        asyncio.create_task(start_telegram_bot())
    except Exception as tg_err:
        log.warning("Telegram bot could not start: %s", tg_err)
    if settings.RUN_BACKGROUND_WORKERS_IN_API:
        try:
            from app.services.appointment_reminder_service import start_reminder_scheduler
            asyncio.create_task(start_reminder_scheduler())
        except Exception as rem_err:
            log.warning("Appointment reminder scheduler could not start: %s", rem_err)
        try:
            from app.services.no_show_scheduler import start_no_show_scheduler
            asyncio.create_task(start_no_show_scheduler())
        except Exception as ns_err:
            log.warning("No-show scheduler could not start: %s", ns_err)
    try:
        yield
    except asyncio.CancelledError:
        # Normal when the process is stopped (Ctrl+C / --reload). Not an app bug.
        log.info("Lifespan cancelled — shutting down.")
        raise
    finally:
        # Shutdown logic (always run; ignore cancel during teardown)
        log.info("Stopping FastAPI application...")
        try:
            from app.services.telegram_polling import stop_telegram_bot
            await stop_telegram_bot()
        except (asyncio.CancelledError, KeyboardInterrupt):
            pass
        except Exception:
            pass
        try:
            from app.services.redis_client import close_redis
            await close_redis()
        except (asyncio.CancelledError, KeyboardInterrupt):
            pass
        except Exception:
            pass
        try:
            await db.disconnect()
        except (asyncio.CancelledError, KeyboardInterrupt):
            pass
        except Exception:
            pass
        log.info("FastAPI application stopped.")

# Initialize FastAPI App
app = FastAPI(
    title="MedClues API",
    description="Drop-in replacement for Node.js backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS — DEBUG: any localhost port; production: explicit allowlist only (no wildcard).
_cors_common = {
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
_cors_kwargs = {
    **_cors_common,
    "allow_origins": cors_allowed_origins(),
    "allow_origin_regex": cors_origin_regex(),
}

app.add_middleware(CORSMiddleware, **_cors_kwargs)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(MaintenanceModeMiddleware)
app.add_middleware(PrometheusMiddleware)


# Register Routers
app.include_router(health_routes.router)
app.include_router(link_routes.router)
app.include_router(admin_routes.router)
app.include_router(doctor_routes.router)
app.include_router(user_routes.router)
app.include_router(appointment_routes.router)
app.include_router(blood_bank_routes.router)
app.include_router(lab_routes.router)
app.include_router(hospital_routes.router)
app.include_router(emergency_routes.router)
app.include_router(ai_routes.router)
app.include_router(job_application_routes.router)
app.include_router(otp_routes.router)
app.include_router(specialty_routes.router)
app.include_router(location_routes.router)
app.include_router(dean_routes.router)
app.include_router(super_appointment_routes.router)
app.include_router(payments_routes.router)
app.include_router(charts_routes.router)
app.include_router(auth_routes.router)
app.include_router(reception_routes.router)

# ── Emergency Partner Platform ──────────────────────────────────────────────
app.include_router(partner_emergency_routes.router)
app.include_router(partner_emergency_routes.router_v1)
app.include_router(partner_admin_routes.router)
# Phase 2: Dispatch (hospital dean portal + ambulance operator)
app.include_router(dispatch_routes.router)
# Phase 3: Partner dashboard + public tracking
app.include_router(partner_dashboard_routes.router)
app.include_router(partner_dashboard_routes.public_router)
# Enterprise pharmacy (PharmaSync) + lab partner (FHIR-lite)
app.include_router(partner_pharmacy_routes.router)
app.include_router(partner_lab_routes.router)
app.include_router(user_pharmacy_routes.router)
app.include_router(dean_pharmacy_routes.router)
# Phase 3 — remaining partner domain templates (radiology, insurance, …)
app.include_router(partner_domain_stub_routes.admin_catalog_router)
for _domain_router in partner_domain_stub_routes.domain_routers:
    app.include_router(_domain_router)

# Medicine Information (openFDA — API key stays on server)
app.include_router(medicine_routes.router)
# Health Protection (insurance / protection hub)
app.include_router(health_protection_routes.router)
app.include_router(user_community_routes.router)
app.include_router(doctor_community_routes.router)
app.include_router(admin_community_routes.router)
app.include_router(dean_community_routes.router)
# Enterprise search + ops/SLO/chaos
app.include_router(search_routes.router)
app.include_router(ops_routes.router)
app.include_router(public_appointment_routes.router)
app.include_router(order_routing_routes.router)

# --- Real-time Socket.IO ---
from app.services.socket_service import sio_app
# Mounting at /socket.io to allow handling while keeping other routes accessible
app.mount("/socket.io", sio_app)

# --- Real-time Payment Updates (WebSocket) ---
from app.services.websocket_service import manager

@app.websocket("/payment-updates")
async def websocket_endpoint(websocket: WebSocket):
    appointment_id = websocket.query_params.get("appointmentId")
    token = (
        websocket.query_params.get("token")
        or websocket.query_params.get("accessToken")
        or websocket.headers.get("token")
    )
    if not appointment_id or not token:
        await websocket.close(code=1008)
        return

    try:
        from jose import jwt as _jwt
        from app.services.token_service import verify_access_payload
        from app.models import appointment_model
        from app.utils.ownership import coerce_user_id

        secret = (settings.JWT_SECRET or "").strip('"').strip("'")
        payload = _jwt.decode(token, secret, algorithms=["HS256"])
        verify_access_payload(payload)
        user_id = coerce_user_id(payload.get("id")) or coerce_user_id(payload.get("userId"))
        role = (payload.get("role") or "patient").lower()
        appt = await appointment_model.get_appointment_by_id(int(appointment_id))
        if not appt:
            await websocket.close(code=1008)
            return
        if role == "patient" and user_id is not None:
            if int(appt.get("user_id") or 0) != int(user_id):
                await websocket.close(code=1008)
                return
        elif role not in ("admin", "doctor", "dean", "reception", "receptionist"):
            await websocket.close(code=1008)
            return
    except Exception:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, appointment_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, appointment_id)
    except Exception as e:
        print(f"WebSocket Error: {e}")
        manager.disconnect(websocket, appointment_id)

from fastapi.exceptions import RequestValidationError

from fastapi.encoders import jsonable_encoder

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    log.warning("Validation error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder({"success": False, "message": "Validation Error", "detail": exc.errors()})
    )

@app.get("/api/config/integrations")
async def integrations_config():
    from app.services import agora_service
    return {
        "success": True,
        "agora": agora_service.agora_configured(),
        "agoraAppId": settings.AGORA_APP_ID if agora_service.agora_configured() else None,
        "razorpay": bool(settings.RAZORPAY_KEY_ID),
    }


@app.get("/api/config/platform")
async def platform_config():
    from app.models import platform_settings_model
    s = await platform_settings_model.get_settings()
    return {
        "success": True,
        "system_name": s.get("system_name", "MedClues"),
        "maintenance_mode": bool(s.get("maintenance_mode")),
    }

@app.get("/api/config/debug")
async def debug_config():
    return {
        "success": True,
        "FRONTEND_URL": settings.FRONTEND_URL,
        "BACKEND_URL": settings.BACKEND_URL,
        "ADMIN_PANEL_URL": settings.ADMIN_PANEL_URL,
    }


# Root Endpoint — allow HEAD too so uptime monitors (UptimeRobot sends HEAD by
# default) get 200 instead of 405 and reliably keep the instance warm.
@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {"message": "API Working", "version": "1.0.0", "status": "Ready"}

# Global Error Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    tb_str = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    log.error("Unhandled error on %s %s: %s\n%s", request.method, request.url.path, type(exc).__name__, tb_str)
    content = {
        "success": False,
        "message": "Internal server error.",
    }
    # Never leak stack traces to clients outside DEBUG
    if settings.DEBUG:
        content["error_type"] = type(exc).__name__
        content["error_detail"] = str(exc)
        content["traceback"] = tb_str
    return JSONResponse(status_code=500, content=content)

# Create uploads directory if it doesn't exist
if not os.path.exists("uploads"):
    os.makedirs("uploads")

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

if __name__ == "__main__":
    # Quiet Ctrl+C on Windows: uvicorn>=0.29 re-raises KeyboardInterrupt and
    # Starlette may log CancelledError during lifespan — neither is an app failure.
    try:
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=int(settings.PORT),
            reload=True,
        )
    except KeyboardInterrupt:
        pass
