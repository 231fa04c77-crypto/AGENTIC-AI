import bcrypt
import json
import os
import time
from datetime import datetime, timedelta
from jose import jwt
from fastapi import HTTPException, UploadFile, File
from typing import Optional, List, Dict, Any, Union
from app.config.config import settings
from app.config.db import db
from app.services import token_service
from app.models import user_model, doctor_model, appointment_model, consultation_model, health_record_model
from app.utils.formatters import format_user, format_doctor, format_appointment_for_frontend, parse_json_field, format_health_record
from app.services import queue_service, email_service, audit_service
from app.utils import password_hash as _ph
import cloudinary.uploader

async def verify_password(password: str, hashed: str) -> bool:
    return await _ph.verify_password(password, hashed)

async def get_password_hash(password: str) -> str:
    return await _ph.hash_password(password)
# Helper to generate JWT token for Doctor (legacy callers)
def create_doctor_token(doc_id: int):
    return token_service.create_access_token("doctor", user_id=doc_id)

# API for doctor Login
async def login_doctor(req_body: dict):
    try:
        email = req_body.get('email')
        password = req_body.get('password')
        
        doctor = await doctor_model.get_doctor_by_email(email)
        if not doctor:
            return {"success": False, "message": "Invalid credentials"}

        if await verify_password(password, doctor['password']):
            auth_response = await token_service.issue_token_pair(
                "doctor",
                user_id=doctor['id'],
                email=doctor.get('email'),
                profile={
                    "id": doctor["id"],
                    "name": doctor.get("name"),
                    "email": doctor.get("email"),
                    "speciality": doctor.get("speciality") or doctor.get("specialty"),
                    "image": doctor.get("image"),
                },
            )

            # --- Auto-secure Plain Text password if detected ---
            is_bcrypt = doctor['password'].startswith('$2b$') or doctor['password'].startswith('$2a$') or doctor['password'].startswith('$2y$')
            if not is_bcrypt:
                try:
                    new_hash = await get_password_hash(password)
                    await doctor_model.update_doctor_password(doctor['id'], new_hash)
                    print(f"[SECURITY] Successfully upgraded plain-text password to secure bcrypt hash for doctor: {email}", flush=True)
                except Exception as hash_err:
                    print(f"[WARNING] Failed to secure doctor password on login: {hash_err}", flush=True)

            return auth_response
        else:
            return {"success": False, "message": "Invalid credentials"}
    except Exception as e:
        print(f"[ERROR] Doctor Login Error: {e}")
        return {"success": False, "message": str(e)}

async def batch_fetch_users_for_appointments(appointments: List[dict]) -> dict:
    user_ids = set()
    for apt in appointments:
        if apt.get('user_id'):
            # Only fetch if snapshot user_data is missing name or age details
            user_data = parse_json_field(apt.get('user_data'))
            if not user_data.get('name') or not (user_data.get('dob') or user_data.get('age')):
                user_ids.add(int(apt['user_id']))
    if not user_ids:
        return {}
    try:
        from app.config.db import db
        rows = await db.query(
            "SELECT * FROM users WHERE id = ANY($1)",
            list(user_ids)
        )
        return {r['id']: r for r in rows}
    except Exception as e:
        print(f"[WARNING] batch_fetch_users failed: {e}")
        return {}

async def _enrich_user_data_for_appointment(apt: dict, user_data: dict, users_map: Optional[dict] = None) -> dict:
    """Fill missing name/dob/age from live user profile when booking snapshot is incomplete."""
    if not apt.get('user_id'):
        return user_data
    if user_data.get('name') and (user_data.get('dob') or user_data.get('age')):
        return user_data
    
    uid = apt['user_id']
    if users_map and uid in users_map:
        live = users_map[uid]
    else:
        live = await user_model.get_user_by_id(uid)

    if not live:
        return user_data
    fresh = format_user(live) or {}
    merged = dict(user_data)
    for key in ('name', 'email', 'phone', 'image', 'dob', 'age', 'gender'):
        if not merged.get(key) and fresh.get(key):
            merged[key] = fresh[key]
    return merged


async def _format_doctor_appointment(apt: dict, users_map: Optional[dict] = None) -> dict:
    user_data = parse_json_field(apt.get('user_data'))
    user_data = await _enrich_user_data_for_appointment(apt, user_data, users_map)
    return format_appointment_for_frontend(apt, user_data)


def _is_online_appointment(apt: dict) -> bool:
    mode = str(apt.get('mode') or '').lower()
    pm = str(apt.get('payment_method') or '').lower()
    return (
        'online' in mode
        or 'video' in mode
        or pm in ('razorpay', 'onlinepayment', 'online')
        or bool(apt.get('payment'))
    )


def _slot_date_is_today_ist(slot_date_str: str) -> bool:
    from zoneinfo import ZoneInfo
    from app.services.doctor_slot_service import legacy_slot_date, legacy_slot_date_padded

    if not slot_date_str:
        return False
    today = datetime.now(ZoneInfo('Asia/Kolkata')).date()
    return slot_date_str in (
        legacy_slot_date(today),
        legacy_slot_date_padded(today),
    )


# API to get doctor appointments
async def appointments_doctor(doc_id: int):
    try:
        raw_appointments = await appointment_model.get_appointments_by_doctor_id(doc_id)
        users_map = await batch_fetch_users_for_appointments(raw_appointments)
        appointments = []
        for apt in raw_appointments:
            appointments.append(await _format_doctor_appointment(apt, users_map))
        return {"success": True, "appointments": appointments}
    except Exception as e:
        return {"success": False, "message": str(e)}

# API to cancel/reject appointment
async def appointment_cancel(doc_id: int, appointment_id: int, reason: Optional[str] = None):
    try:
        appointment = await appointment_model.get_appointment_by_id(appointment_id)
        if appointment and appointment['doctor_id'] == doc_id:
            try:
                await appointment_model.cancel_appointment(appointment_id)
            except ValueError as ve:
                return {"success": False, "message": str(ve)}
            try:
                from app.services import doctor_slot_service
                await doctor_slot_service.release_slot_for_appointment(appointment)
            except Exception as slot_err:
                print(f"[WARNING] Slot release on cancel: {slot_err}")
            
            # Send Rejection/Cancellation Email
            try:
                user = await user_model.get_user_by_id(appointment['user_id'])
                if user:
                    await email_service.send_appointment_rejection(
                        user['email'],
                        user['name'],
                        {
                            "doctorName": appointment.get('doctor_data', {}).get('name', 'Doctor'),
                            "date": str(appointment.get('slot_date', '')).replace('_', '/'),
                            "time": appointment.get('slot_time', ''),
                            "tokenNumber": appointment.get('token_number', 'N/A'),
                            "publicId": appointment.get("public_id") or None,
                            "bookingId": appointment.get("booking_id") or None,
                            "reason": reason or "Administrative conflict",
                        },
                    )
            except Exception as e:
                print(f"[WARNING] Rejection email failed: {e}")

            return {"success": True, "message": 'Appointment Cancelled/Rejected'}
        return {"success": False, "message": 'Unauthorized or not found'}
    except Exception as e:
        return {"success": False, "message": str(e)}

# API to accept (confirm) appointment
async def appointment_accept(doc_id: int, appointment_id: int):
    try:
        appointment = await appointment_model.get_appointment_by_id(appointment_id)
        if not appointment:
            return {"success": False, "message": "Appointment not found"}
        if appointment['doctor_id'] != doc_id:
            return {"success": False, "message": "Unauthorized"}
        if appointment.get('cancelled'):
            return {"success": False, "message": "Cannot accept a cancelled appointment"}
        if appointment.get('is_completed'):
            return {"success": False, "message": "Appointment already completed"}

        # Set lifecycle_status = 'CONFIRMED' — this column has no CHECK constraint.
        # Do NOT update `status` — it is constrained to a fixed enum that does not
        # include 'confirmed'. The lifecycle_status column is the correct field for
        # workflow state (BOOKED → CONFIRMED → IN_QUEUE → …).
        await db.execute(
            """
            UPDATE appointments
            SET lifecycle_status = 'CONFIRMED',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            """,
            int(appointment_id),
        )

        # Send confirmation email (best-effort, never fail the accept action)
        try:
            user = await user_model.get_user_by_id(appointment['user_id'])
            if user:
                await email_service.send_appointment_confirmation(
                    user['email'],
                    {
                        "patientName": user.get('name', 'Patient'),
                        "doctorName": appointment.get('doctor_data', {}).get('name', 'Doctor'),
                        "date": str(appointment.get('slot_date', '')).replace('_', '/'),
                        "time": appointment.get('slot_time', ''),
                        "tokenNumber": appointment.get('token_number', 'N/A'),
                        "publicId": appointment.get("public_id") or None,
                        "bookingId": appointment.get("booking_id") or None,
                    },
                )
        except Exception as e:
            print(f"[WARNING] Accept confirmation email failed: {e}")

        try:
            from app.services.journey_notify import notify_patient
            await notify_patient(
                int(appointment["user_id"]),
                "Doctor accepted",
                "Your doctor confirmed this visit. Consultation is scheduled.",
                {"type": "appointment", "appointmentId": str(appointment_id)},
            )
        except Exception:
            pass

        return {"success": True, "message": "Appointment confirmed"}
    except Exception as e:
        return {"success": False, "message": str(e)}

# API to mark appointment completed
async def appointment_complete(doc_id: int, appointment_id: int, body: dict | None = None):
    try:
        from app.controllers import lifecycle_controller

        return await lifecycle_controller.complete_consultation(
            doc_id,
            int(appointment_id),
            body or {},
        )
    except Exception as e:
        return {"success": False, "message": str(e)}

# API to get all doctors list for Frontend
async def doctor_list(
    hospital_id: Optional[int] = None,
    limit: Optional[int] = 100,
    offset: int = 0,
    q: Optional[str] = None,
):
    try:
        from app.services import cache_keys as ck
        from app.services import cache_service as cache

        lim = max(1, min(int(limit or 100), 2000))
        off = max(0, int(offset or 0))
        cache_key = ck.doctor_list(hospital_id, lim, off, q or "")

        async def _load():
            if hospital_id:
                doctors = await doctor_model.get_doctors_by_hospital_id(hospital_id)
                if q and q.strip():
                    ql = q.strip().lower()
                    doctors = [
                        d for d in doctors
                        if ql in (d.get("name") or "").lower()
                        or ql in (d.get("speciality") or "").lower()
                    ]
                doctors = doctors[off : off + lim]
            else:
                doctors = await doctor_model.get_all_doctors(limit=lim, offset=off, q=q)

            formatted_doctors = [format_doctor(doc) for doc in doctors]
            return {
                "success": True,
                "doctors": formatted_doctors,
                "limit": lim,
                "offset": off,
            }

        return await cache.cache_aside(cache_key, ck.TTL_DOCTOR_LIST, _load)
    except Exception as e:
        return {"success": False, "message": str(e)}

# API to toggle doctor availability
async def change_availability(doc_id: Union[str, int]):
    try:
        doc_data = await doctor_model.get_doctor_by_id(doc_id)
        if not doc_data:
            return {"success": False, "message": "Doctor not found"}
            
        new_avail = not doc_data['available']
        await doctor_model.update_doctor(doc_id, {
            'available': new_avail,
            'status': 'available' if new_avail else 'unavailable'
        })
        try:
            from app.services import cache_service as cache
            await cache.invalidate_doctors()
        except Exception:
            pass
        return {"success": True, "message": 'Availability Changed'}
    except Exception as e:
        return {"success": False, "message": str(e)}

# API to get doctor profile
async def doctor_profile(doc_id):
    try:
        from app.services import cache_keys as ck
        from app.services import cache_service as cache

        async def _load():
            doctor = await doctor_model.get_doctor_by_id(doc_id)
            if not doctor:
                return {"success": False, "message": "Doctor not found"}
            profile_data = format_doctor(doctor)
            if profile_data:
                profile_data.pop('password', None)
            return {"success": True, "profileData": profile_data}

        return await cache.cache_aside(ck.doctor(doc_id), ck.TTL_DOCTOR_PROFILE, _load)
    except Exception as e:
        return {"success": False, "message": str(e)}

# API to update doctor profile
async def update_doctor_profile(doc_id: int, form_data: dict, image=None):
    try:
        update_data = {}

        if form_data.get('fees') is not None:
            try:
                update_data['fees'] = float(form_data['fees'])
            except (ValueError, TypeError):
                pass

        if form_data.get('about') is not None:
            update_data['about'] = form_data['about']

        if form_data.get('available') is not None:
            val = form_data['available']
            if isinstance(val, str):
                update_data['available'] = val.lower() in ('true', '1', 'yes')
            else:
                update_data['available'] = bool(val)

        if form_data.get('address') is not None:
            import json as _json
            try:
                addr = _json.loads(form_data['address'])
            except Exception:
                addr = {'line1': form_data['address'], 'line2': ''}
            update_data['address'] = addr

        if form_data.get('status') is not None:
            st = form_data['status']
            update_data['status'] = st
            # Sync available field if status is provided
            if st in ('available', 'busy', 'online', 'in-clinic', 'inclinic', 'in-consult'):
                update_data['available'] = True
            elif st in ('unavailable', 'emergency', 'offline', 'inactive', 'on-break'):
                update_data['available'] = False

        previous_status = None
        if 'status' in update_data:
            existing = await doctor_model.get_doctor_by_id(doc_id)
            previous_status = (existing or {}).get('status')

        if form_data.get('opStart') is not None:
            update_data['op_start'] = form_data['opStart']

        if form_data.get('opEnd') is not None:
            update_data['op_end'] = form_data['opEnd']

        if form_data.get('opStartAfternoon') is not None:
            update_data['op_start_afternoon'] = form_data['opStartAfternoon']

        if form_data.get('opEndAfternoon') is not None:
            update_data['op_end_afternoon'] = form_data['opEndAfternoon']

        if form_data.get('maxAppointmentsMorning') is not None:
            try:
                update_data['max_appointments_morning'] = int(form_data['maxAppointmentsMorning'])
            except (ValueError, TypeError):
                pass

        if form_data.get('maxAppointmentsAfternoon') is not None:
            try:
                update_data['max_appointments_afternoon'] = int(form_data['maxAppointmentsAfternoon'])
            except (ValueError, TypeError):
                pass

        if form_data.get('videoOpStart') is not None:
            update_data['video_op_start'] = form_data['videoOpStart']

        if form_data.get('videoOpEnd') is not None:
            update_data['video_op_end'] = form_data['videoOpEnd']

        if form_data.get('maxVideoSlots') is not None:
            try:
                update_data['max_video_slots'] = max(0, min(48, int(form_data['maxVideoSlots'])))
            except (ValueError, TypeError):
                pass

        if form_data.get('videoSlotMinutes') is not None:
            try:
                mins = int(form_data['videoSlotMinutes'])
                if mins in (10, 15, 20, 30, 45, 60):
                    update_data['video_slot_minutes'] = mins
            except (ValueError, TypeError):
                pass

        if form_data.get('availableDays') is not None:
            import json as _json
            days_val = form_data['availableDays']
            if isinstance(days_val, str):
                try:
                    days_val = _json.loads(days_val)
                except Exception:
                    days_val = [d.strip() for d in days_val.split(',') if d.strip()]
            if isinstance(days_val, list):
                update_data['available_days'] = [str(d) for d in days_val]

        if image and image.filename:
            file_bytes = await image.read()
            import cloudinary.uploader, io
            from app.services.cloudinary_folders import doctor_profile_folder

            doctor_row = await doctor_model.get_doctor_by_id(doc_id)
            result = cloudinary.uploader.upload(
                io.BytesIO(file_bytes),
                folder=doctor_profile_folder(doctor_row, doctor_id=doc_id),
                resource_type="image",
            )
            update_data["image"] = result.get("secure_url", "")

        if not update_data:
            return {"success": False, "message": "No data to update"}

        updated = await doctor_model.update_doctor(doc_id, update_data)
        if not updated:
            return {"success": False, "message": "Update failed"}

        try:
            from app.services import cache_service as cache
            await cache.invalidate_doctors()
        except Exception:
            pass
            
        try:
            from app.models.appointment_model import sync_appointments_doctor_data
            await sync_appointments_doctor_data(doc_id)
        except Exception as sync_err:
            print(f"[WARNING] Syncing doctor data to appointments failed: {sync_err}")

        # Check if schedule fields were updated
        schedule_keys = {'op_start', 'op_end', 'op_start_afternoon', 'op_end_afternoon', 
                         'max_appointments_morning', 'max_appointments_afternoon', 'available_days',
                         'video_op_start', 'video_op_end', 'max_video_slots', 'video_slot_minutes'}
        if any(k in update_data for k in schedule_keys):
            try:
                from app.controllers.doctor_slot_controller import invalidate_slots_cache
                from app.services.doctor_slot_service import regenerate_future_slots
                # Drop stale booking counts immediately, then regenerate so the
                # next /slots fetch reflects the capacity the doctor just saved.
                invalidate_slots_cache(str(doc_id))
                await regenerate_future_slots(str(doc_id))
            except Exception as slot_err:
                print(f"[WARNING] doctor slot regeneration failed: {slot_err}")

        if 'status' in update_data:
            try:
                from app.services.doctor_status_notify_service import broadcast_doctor_status_change
                await broadcast_doctor_status_change(
                    doc_id,
                    update_data['status'],
                    previous_status=previous_status,
                )
            except Exception as notify_err:
                print(f"[WARNING] doctor status notify failed: {notify_err}")
            
        return {"success": True, "message": "Profile Updated Successfully"}
    except Exception as e:
        print(f"[ERROR] update_doctor_profile error: {e}")
        return {"success": False, "message": str(e)}

# API to update doctor live status (queue panel)
async def update_doctor_status(doc_id: int, body: dict):
    try:
        new_status = (body.get('status') or '').strip().lower()
        if not new_status:
            return {"success": False, "message": "Status is required"}

        allowed = {'in-clinic', 'in-consult', 'on-break', 'unavailable', 'available', 'emergency', 'offline'}
        if new_status not in allowed:
            return {"success": False, "message": f"Invalid status. Allowed: {', '.join(sorted(allowed))}"}

        existing = await doctor_model.get_doctor_by_id(doc_id)
        if not existing:
            return {"success": False, "message": "Doctor not found"}

        previous_status = existing.get('status')
        available = new_status not in ('unavailable', 'offline', 'on-break')

        await doctor_model.update_doctor(doc_id, {
            'status': new_status,
            'available': available,
        })

        break_duration = body.get('breakDuration')
        notify_result = {}
        try:
            from app.services.doctor_status_notify_service import broadcast_doctor_status_change
            notify_result = await broadcast_doctor_status_change(
                doc_id,
                new_status,
                previous_status=previous_status,
                break_duration=int(break_duration) if break_duration else None,
            )
        except Exception as notify_err:
            print(f"[WARNING] doctor status notify failed: {notify_err}")

        label = new_status.replace('-', ' ').title()
        return {
            "success": True,
            "message": f"Status updated to {label}",
            "status": new_status,
            "notify": notify_result,
        }
    except Exception as e:
        print(f"[ERROR] update_doctor_status: {e}")
        return {"success": False, "message": str(e)}

# API to get dashboard data
async def doctor_dashboard(doc_id: int):
    try:
        from app.services import cache_keys as ck
        from app.services import cache_service as cache

        async def _load():
            appointments = await appointment_model.get_appointments_by_doctor_id(doc_id)
            users_map = await batch_fetch_users_for_appointments(appointments)
            
            earnings = 0
            patients_set = set()
            
            for apt in appointments:
                if apt['is_completed'] or apt['payment']:
                    earnings += float(apt['amount'])
                if apt['user_id']:
                    patients_set.add(apt['user_id'])
                    
            latest = []
            for apt in list(reversed(appointments))[:15]:
                latest.append(await _format_doctor_appointment(apt, users_map))

            video_vc = []
            for apt in appointments:
                if (
                    _is_online_appointment(apt)
                    and not apt.get('cancelled')
                    and not apt.get('is_completed')
                ):
                    video_vc.append(await _format_doctor_appointment(apt, users_map))

            dash_data = {
                "earnings": earnings,
                "appointments": len(appointments),
                "patients": len(patients_set),
                "latestAppointments": latest,
                "todayVideoConsults": video_vc,
                "upcomingVideoConsults": video_vc,
            }
            return {"success": True, "dashData": dash_data}

        return await cache.cache_aside(ck.dashboard_doctor(doc_id), ck.TTL_DASHBOARD, _load)
    except Exception as e:
        return {"success": False, "message": str(e)}

# API to get queue status
async def get_queue_status(doc_id: int, slot_date: str):
    try:
        queue_status = await queue_service.get_doctor_queue_status(doc_id, slot_date)
        if not queue_status:
            return {"success": True, "queueStatus": {"status": 'in-clinic', "currentAppointmentId": None, "queueLength": 0, "appointments": [], "docId": doc_id}}

        return {"success": True, "queueStatus": {**queue_status, "docId": doc_id}, "suggestions": [], "delayedAppointments": []}
    except Exception as e:
        return {"success": False, "message": str(e)}

# API to get reception-verified in-queue patients
async def get_in_queue(doc_id: int, slot_date: str):
    try:
        from zoneinfo import ZoneInfo
        from app.services.doctor_slot_service import legacy_slot_date, legacy_slot_date_padded
        if not slot_date:
            today = datetime.now(ZoneInfo('Asia/Kolkata')).date()
            slot_date = legacy_slot_date(today)
        queue_data = await queue_service.get_doctor_in_queue(doc_id, slot_date)
        if not queue_data:
            return {"success": True, "queue": {"queueLength": 0, "appointments": [], "currentAppointmentId": None}}
        return {"success": True, "queue": queue_data}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def get_appointment_detail(doc_id: int, appointment_id: int):
    try:
        appointment = await appointment_model.get_appointment_by_id(appointment_id)
        if not appointment or appointment['doctor_id'] != doc_id:
            return {"success": False, "message": "Unauthorized or not found"}
        return {"success": True, "appointment": await _format_doctor_appointment(appointment)}
    except Exception as e:
        return {"success": False, "message": str(e)}

# API to start consultation
async def start_consultation(doc_id: int, appointment_id: int):
    try:
        appointment = await appointment_model.get_appointment_by_id(appointment_id)
        if not appointment or appointment['doctor_id'] != doc_id:
            return {"success": False, "message": 'Invalid appointment'}

        doctor_before = await doctor_model.get_doctor_by_id(doc_id)
        previous_status = (doctor_before or {}).get('status')
            
        await db.execute("UPDATE appointments SET status = $1, alerted = true, updated_at = CURRENT_TIMESTAMP WHERE id = $2", 'in-consult', appointment_id)
        await db.execute("UPDATE doctors SET status = $1, current_appointment_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3", 'in-consult', appointment_id, doc_id)

        try:
            from app.services.doctor_status_notify_service import broadcast_doctor_status_change
            await broadcast_doctor_status_change(
                doc_id, 'in-consult', previous_status=previous_status
            )
        except Exception as notify_err:
            print(f"[WARNING] start consultation status notify: {notify_err}")

        # Notify the first patient still waiting. Avoid duplicate pushes when the
        # same consultation-start request is retried.
        if (doctor_before or {}).get('current_appointment_id') != appointment_id:
            try:
                next_appointment = await queue_service.get_next_waiting_appointment(
                    doc_id,
                    str(appointment.get('slot_date') or ''),
                    appointment_id,
                )
                if next_appointment and next_appointment.get('user_id'):
                    from app.services import fcm_service
                    await fcm_service.notify_patient_next_in_queue(
                        int(next_appointment['user_id']),
                        (doctor_before or {}).get('name') or 'your doctor',
                        int(next_appointment['id']),
                    )
            except Exception as next_notify_err:
                print(f"[WARNING] next patient notify: {next_notify_err}")
        
        return {"success": True, "message": 'Consultation started'}
    except Exception as e:
        return {"success": False, "message": str(e)}

from app.controllers import consultation_controller

async def end_consultation(doc_id: int, req_body: dict):
    try:
        consultation_id = req_body.get('consultationId')
        
        # We can reuse the consultation_controller logic or implement directly
        # The JS version uses endConsultation from consultationController.
        return await consultation_controller.end_consultation(consultation_id, req_body)
    except Exception as e:
        return {"success": False, "message": str(e)}

async def doctor_consultations(doc_id: int):
    try:
        return await consultation_controller.get_doctor_consultations(doc_id)
    except Exception as e:
        return {"success": False, "message": str(e)}

async def get_consultation_details(doc_id: int, consultation_id: int):
    try:
        # Verify doctor is allowed to see this
        consultation = await consultation_model.get_consultation_by_id(consultation_id)
        if not consultation or consultation['doctor_id'] != doc_id:
            return {"success": False, "message": "Unauthorized or not found"}
            
        return await consultation_controller.get_consultation(consultation_id)
    except Exception as e:
        return {"success": False, "message": str(e)}


def _parse_symptoms(raw) -> list:
    if not raw:
        return []
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return raw if isinstance(raw, list) else []


def _format_past_visit(apt: dict, consultation: dict | None) -> dict:
    c = consultation or {}
    followup = c.get('followup_date')
    return {
        "appointmentId": apt.get('id'),
        "slotDate": apt.get('slot_date'),
        "slotTime": apt.get('slot_time'),
        "tokenNumber": apt.get('token_number'),
        "isCompleted": bool(apt.get('is_completed')),
        "cancelled": bool(apt.get('cancelled')),
        "symptoms": _parse_symptoms(apt.get('selected_symptoms')),
        "mode": apt.get('mode'),
        "diagnosis": c.get('diagnosis') or '',
        "prescription": c.get('prescription') or '',
        "notes": c.get('notes') or '',
        "advice": c.get('advice') or '',
        "followupDate": followup.isoformat() if hasattr(followup, 'isoformat') else (followup or ''),
        "consultationDate": (
            c.get('created_at').isoformat()
            if c.get('created_at') and hasattr(c.get('created_at'), 'isoformat')
            else c.get('created_at')
        ),
    }


async def get_patient_history_for_doctor(doc_id: int, appointment_id: int):
    """Return patient profile, past visits with this doctor, and health records."""
    try:
        appointment = await appointment_model.get_appointment_by_id(appointment_id)
        if not appointment or appointment['doctor_id'] != doc_id:
            return {"success": False, "message": "Unauthorized access"}

        user_id = appointment['user_id']
        patient = await user_model.get_user_by_id(user_id)
        if not patient:
            return {"success": False, "message": "Patient not found"}

        await audit_service.log_access(
            action="patient_history.view",
            resource="appointments",
            resource_id=appointment_id,
            actor_id=doc_id,
            actor_role="doctor",
            metadata={"patientUserId": user_id},
        )

        all_patient_apts = await appointment_model.get_appointments_by_user_id(user_id)
        past_with_doctor = [
            apt for apt in all_patient_apts
            if apt.get('doctor_id') == doc_id and apt.get('id') != appointment_id
        ]

        consultations = await consultation_model.get_consultations_by_user_and_doctor(user_id, doc_id)
        consult_by_apt = {c['appointment_id']: c for c in consultations if c.get('appointment_id')}

        past_visits = []
        for apt in past_with_doctor:
            if apt.get('is_completed') or consult_by_apt.get(apt.get('id')):
                past_visits.append(_format_past_visit(apt, consult_by_apt.get(apt.get('id'))))

        past_visits.sort(
            key=lambda v: (v.get('slotDate') or '', v.get('slotTime') or ''),
            reverse=True,
        )

        records = await health_record_model.get_health_records_by_user_id(user_id)
        health_records = [format_health_record(r) for r in records]

        user_data = appointment.get('user_data', {})
        if isinstance(user_data, str):
            try:
                user_data = json.loads(user_data)
            except Exception:
                user_data = {}

        patient_info = format_user(patient) or {}
        if appointment.get('actual_patient_name') and not appointment.get('actual_patient_is_self'):
            patient_info['name'] = appointment.get('actual_patient_name')
            patient_info['relationship'] = appointment.get('actual_patient_relationship') or 'Family'

        return {
            "success": True,
            "patient": patient_info,
            "currentVisit": {
                "appointmentId": appointment_id,
                "slotDate": appointment.get('slot_date'),
                "slotTime": appointment.get('slot_time'),
                "tokenNumber": appointment.get('token_number'),
                "symptoms": _parse_symptoms(appointment.get('selected_symptoms')),
                "arrivedAt": (
                    appointment.get('arrived_at').isoformat()
                    if appointment.get('arrived_at') and hasattr(appointment.get('arrived_at'), 'isoformat')
                    else appointment.get('arrived_at')
                ),
            },
            "pastVisits": past_visits,
            "healthRecords": health_records,
            "summary": {
                "totalPastVisits": len(past_visits),
                "totalHealthRecords": len(health_records),
                "hasPrescriptionHistory": any(v.get('prescription') for v in past_visits),
            },
        }
    except Exception as e:
        print(f"[ERROR] get_patient_history_for_doctor: {e}")
        return {"success": False, "message": str(e)}


async def search_patients(q: str):
    try:
        rows = await user_model.search_users(q, limit=20)
        return {"success": True, "patients": [format_user(r) for r in rows]}
    except Exception as e:
        print(f"[ERROR] doctor_controller.search_patients: {e}")
        return {"success": False, "message": str(e)}


async def get_patient_history_by_user_id(doc_id: int, user_id: int):
    try:
        patient = await user_model.get_user_by_id(user_id)
        if not patient:
            return {"success": False, "message": "Patient not found"}

        all_patient_apts = await appointment_model.get_appointments_by_user_id(user_id)
        past_with_doctor = [
            apt for apt in all_patient_apts
            if apt.get('doctor_id') == doc_id
        ]

        consultations = await consultation_model.get_consultations_by_user_and_doctor(user_id, doc_id)
        consult_by_apt = {c['appointment_id']: c for c in consultations if c.get('appointment_id')}

        past_visits = []
        for apt in past_with_doctor:
            if apt.get('is_completed') or consult_by_apt.get(apt.get('id')):
                past_visits.append(_format_past_visit(apt, consult_by_apt.get(apt.get('id'))))

        past_visits.sort(
            key=lambda v: (v.get('slotDate') or '', v.get('slotTime') or ''),
            reverse=True,
        )

        records = await health_record_model.get_health_records_by_user_id(user_id)
        health_records = [format_health_record(r) for r in records]

        patient_info = format_user(patient) or {}

        return {
            "success": True,
            "patient": patient_info,
            "pastVisits": past_visits,
            "healthRecords": health_records,
            "summary": {
                "totalPastVisits": len(past_visits),
                "totalHealthRecords": len(health_records),
                "hasPrescriptionHistory": any(v.get('prescription') for v in past_visits),
            },
        }
    except Exception as e:
        print(f"[ERROR] get_patient_history_by_user_id: {e}")
        return {"success": False, "message": str(e)}


