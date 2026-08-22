import math
import random
import string
from datetime import datetime
from app.models import consultation_model, doctor_model, user_model, appointment_model
from app.config.db import db
from app.config.config import settings
from app.services import agora_service

# Helper function to calculate distance (Haversine)
def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) * math.sin(d_lat / 2) +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2) * math.sin(d_lon / 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# Generate meeting link (fallback when Agora is not configured)
def generate_meeting_link():
    meeting_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
    return f"https://meet.google.com/{meeting_id}"


def _appointment_is_online(appointment: dict) -> bool:
    mode = (appointment.get('mode') or '').lower()
    payment = (appointment.get('payment_method') or '').lower()
    return mode in ('online', 'video') or payment in ('razorpay', 'onlinepayment', 'online')


async def _ensure_consultation_record(appointment: dict):
    appointment_id = int(appointment['id'])
    existing = await consultation_model.get_consultation_by_appointment_id(appointment_id)
    if existing:
        return existing, None

    channel = agora_service.channel_for_appointment(appointment_id)
    provider = 'agora' if agora_service.agora_configured() else 'google-meet'
    meeting_link = channel if provider == 'agora' else generate_meeting_link()
    meeting_id = channel if provider == 'agora' else meeting_link.split('/')[-1]

    consultation_data = {
        'appointmentId': appointment_id,
        'userId': appointment['user_id'],
        'doctorId': appointment['doctor_id'],
        'type': 'video',
        'status': 'scheduled',
        'meetingLink': meeting_link,
        'meetingId': meeting_id,
        'meetingProvider': provider,
        'scheduledAt': datetime.now(),
    }
    created = await consultation_model.create_consultation(consultation_data)
    return created, None


def _appointment_is_online_video(appointment: dict) -> bool:
    mode = (appointment.get('mode') or '').lower()
    return mode in ('online', 'video')


async def ensure_consultation_for_appointment(user_id: int, appointment_id: int):
    appointment = await appointment_model.get_appointment_by_id(int(appointment_id))
    if not appointment or appointment['user_id'] != user_id:
        return None, 'Appointment not found'

    if appointment.get('cancelled'):
        return None, 'This appointment was cancelled'

    if not _appointment_is_online_video(appointment):
        return None, 'Video call is only available for online consultations'

    return await _ensure_consultation_record(appointment)


async def ensure_consultation_for_doctor(doctor_id: int, appointment_id: int):
    appointment = await appointment_model.get_appointment_by_id(int(appointment_id))
    if not appointment or appointment['doctor_id'] != doctor_id:
        return None, 'Appointment not found'

    if appointment.get('cancelled'):
        return None, 'This appointment was cancelled'

    if not _appointment_is_online_video(appointment):
        return None, 'Video call is only available for online consultations'

    return await _ensure_consultation_record(appointment)


def _call_started_at_ms(consultation: dict):
    """Return shared call start in ms, or None until both parties have joined."""
    started = consultation.get('started_at')
    if started is None:
        return None
    if hasattr(started, 'timestamp'):
        return int(started.timestamp() * 1000)
    return None


async def _refresh_consultation(consultation: dict):
    refreshed = await consultation_model.get_consultation_by_id(consultation['id'])
    return refreshed or consultation


async def _clear_call_timer(consultation: dict):
    """Reset talk timer until both parties connect via sync_call_timer."""
    await db.execute(
        'UPDATE consultations SET started_at = NULL, updated_at = CURRENT_TIMESTAMP '
        'WHERE id = $1 AND ended_at IS NULL',
        consultation['id'],
    )
    return await _refresh_consultation(consultation)


async def _ensure_consultation_started(consultation: dict):
    """Mark call ongoing. Shared started_at is set later via sync_call_timer."""
    consultation = await _refresh_consultation(consultation)
    status = (consultation.get('status') or '').lower()

    if status == 'completed':
        await consultation_model.update_consultation(consultation['id'], {
            'status': 'ongoing',
        })
        consultation = await _clear_call_timer(consultation)
        return consultation

    if status == 'ongoing':
        return consultation

    await consultation_model.update_consultation(consultation['id'], {
        'status': 'ongoing',
    })
    return await _refresh_consultation(consultation)


def _agora_join_payload(channel: str, uid: int, consultation: dict):
    token = agora_service.build_rtc_token(channel, uid)
    if not token:
        return None, (
            'Failed to generate Agora token. Verify AGORA_APP_ID and '
            'AGORA_APP_CERTIFICATE in fastapi_back/.env (32 hex chars each), then restart the API.'
        )
    return {
        'success': True,
        'appId': agora_service.normalized_app_id(),
        'channel': channel,
        'token': token,
        'uid': uid,
        'consultationId': consultation['id'],
        'consultationStatus': consultation.get('status'),
    }, None


async def get_agora_token_for_appointment(user_id: int, appointment_id: int):
    if not agora_service.agora_configured():
        return {
            'success': False,
            'message': 'Agora is not configured on the server (AGORA_APP_ID / AGORA_APP_CERTIFICATE)',
        }

    from app.controllers import call_session_controller
    from app.utils.vc_slot_window import slot_window_payload

    gate = await call_session_controller.assert_can_issue_patient_token(user_id, appointment_id)
    if gate:
        return {'success': False, 'message': gate}

    consultation, err = await ensure_consultation_for_appointment(user_id, appointment_id)
    if err:
        return {'success': False, 'message': err}

    consultation = await _ensure_consultation_started(consultation)
    await call_session_controller.mark_ongoing_if_joined(int(appointment_id))

    channel = consultation.get('meeting_id') or agora_service.channel_for_appointment(int(appointment_id))
    uid = agora_service.uid_for_patient(int(appointment_id))
    payload, token_err = _agora_join_payload(channel, uid, consultation)
    if token_err:
        return {'success': False, 'message': token_err}
    payload['role'] = 'patient'
    appointment = await appointment_model.get_appointment_by_id(int(appointment_id))
    if appointment:
        payload['slotWindow'] = slot_window_payload(appointment)
    return payload


async def get_agora_token_for_doctor_appointment(doctor_id: int, appointment_id: int):
    if not agora_service.agora_configured():
        return {
            'success': False,
            'message': 'Agora is not configured on the server (AGORA_APP_ID / AGORA_APP_CERTIFICATE)',
        }

    from app.utils.vc_slot_window import assert_within_join_window, slot_window_payload

    appointment = await appointment_model.get_appointment_by_id(int(appointment_id))
    if appointment:
        window_err = assert_within_join_window(appointment)
        if window_err:
            return {'success': False, 'message': window_err, 'slotWindow': slot_window_payload(appointment)}

    consultation, err = await ensure_consultation_for_doctor(doctor_id, appointment_id)
    if err:
        return {'success': False, 'message': err}

    from app.controllers import call_session_controller
    from app.models import call_session_model
    existing_session = await call_session_model.get_by_appointment(int(appointment_id))
    if existing_session and existing_session['status'] in ('requested', 'ringing'):
        await call_session_controller.accept_call(doctor_id, int(appointment_id))
    elif not existing_session:
        appointment = appointment or await appointment_model.get_appointment_by_id(int(appointment_id))
        if appointment:
            channel = consultation.get('meeting_id') or agora_service.channel_for_appointment(int(appointment_id))
            await call_session_model.create_session({
                'appointment_id': int(appointment_id),
                'consultation_id': consultation['id'],
                'patient_user_id': appointment['user_id'],
                'doctor_id': doctor_id,
                'status': 'accepted',
                'agora_channel': channel,
            })

    await db.execute(
        "UPDATE appointments SET status = $1, alerted = true, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        'in-consult',
        int(appointment_id),
    )
    await db.execute(
        "UPDATE doctors SET status = $1, current_appointment_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
        'in-consult',
        int(appointment_id),
        doctor_id,
    )
    consultation = await _ensure_consultation_started(consultation)
    consultation = await _clear_call_timer(consultation)
    await call_session_controller.mark_ongoing_if_joined(int(appointment_id))

    channel = consultation.get('meeting_id') or agora_service.channel_for_appointment(int(appointment_id))
    uid = agora_service.uid_for_doctor(int(appointment_id))
    payload, token_err = _agora_join_payload(channel, uid, consultation)
    if token_err:
        return {'success': False, 'message': token_err}
    payload['role'] = 'doctor'
    if appointment:
        payload['slotWindow'] = slot_window_payload(appointment)

    # Attach fresh clinical context (symptoms / reports / patient) so the room
    # never depends on a possibly-stale cached appointment list.
    try:
        appt_row = appointment or await appointment_model.get_appointment_by_id(int(appointment_id))
        if appt_row:
            from app.utils.formatters import format_appointment_for_frontend
            formatted = format_appointment_for_frontend(appt_row)
            payload['appointment'] = {
                'selectedSymptoms': formatted.get('selectedSymptoms'),
                'actualPatient': formatted.get('actualPatient'),
                'userData': formatted.get('userData'),
            }
    except Exception as ctx_err:
        print(f"[WARNING] Could not attach consult context: {ctx_err}")

    return payload

async def get_video_consult_doctors(lat: float = None, lon: float = None, distance: str = 'all'):
    try:
        doctors = await consultation_model.get_video_consult_doctors_query()
        
        formatted_docs = []
        for doc in doctors:
            doc_lat = doc.get('location_lat')
            doc_lon = doc.get('location_lng')
            
            dist = None
            if lat and lon and doc_lat and doc_lon:
                dist = calculate_distance(lat, lon, float(doc_lat), float(doc_lon))
                
                if distance != 'all':
                    max_dist = int(distance.replace('km', ''))
                    if dist > max_dist:
                        continue
            
            formatted_docs.append({
                "_id": doc['id'],
                "name": doc['name'],
                "image": doc['image'],
                "speciality": doc['speciality'],
                "degree": doc['degree'],
                "experience": doc['experience'],
                "fees": float(doc['fees']),
                "status": doc.get('status', 'offline'),
                "location": {"lat": doc_lat, "lng": doc_lon},
                "distance": round(dist, 2) if dist else None
            })
            
        if lat and lon:
            formatted_docs.sort(key=lambda x: x['distance'] or float('inf'))
            
        return {"success": True, "doctors": formatted_docs}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def create_consultation(user_id: int, req_body: dict):
    try:
        from app.utils.ownership import reject_client_user_override

        override_err = reject_client_user_override(req_body, user_id)
        if override_err:
            return override_err

        doctor_id = req_body.get('doctorId')
        
        doctor = await doctor_model.get_doctor_by_id(doctor_id)
        if not doctor:
            return {"success": False, "message": "Doctor not found"}
            
        if not doctor.get('video_consult'):
            return {"success": False, "message": "Doctor does not offer video consultation"}

        if doctor.get('status') not in ['online', 'in-clinic']:
            return {"success": False, "message": "Doctor is not available at the moment"}

        appointment_id = req_body.get('appointmentId')
        if appointment_id:
            consultation, err = await ensure_consultation_for_appointment(user_id, int(appointment_id))
            if err:
                return {"success": False, "message": err}
            return {
                "success": True,
                "consultationId": consultation['id'],
                "meetingLink": consultation.get('meeting_link'),
                "channel": consultation.get('meeting_id'),
                "message": "Consultation ready",
            }

        channel = f"medi_live_{doctor_id}_{user_id}_{int(datetime.now().timestamp())}"
        if agora_service.agora_configured():
            meeting_link = channel
            meeting_id = channel
            provider = 'agora'
        else:
            meeting_link = generate_meeting_link()
            meeting_id = meeting_link.split('/')[-1]
            provider = 'google-meet'

        consultation_data = {
            "userId": user_id,
            "doctorId": doctor_id,
            "type": 'video',
            "status": 'scheduled',
            "meetingLink": meeting_link,
            "meetingId": meeting_id,
            "meetingProvider": provider,
            "scheduledAt": datetime.now()
        }
        
        consultation = await consultation_model.create_consultation(consultation_data)
        
        # Update doctor status
        await db.execute('UPDATE doctors SET status = $1, current_appointment_id = $2 WHERE id = $3', 'in-consult', consultation['id'], doctor_id)
        
        return {
            "success": True,
            "consultationId": consultation['id'],
            "meetingLink": meeting_link,
            "message": "Consultation created successfully"
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

async def start_consultation(consultation_id: int):
    try:
        updated = await consultation_model.update_consultation(consultation_id, {
            "status": 'ongoing',
        })
        return {"success": True, "consultation": updated}
    except Exception as e:
        return {"success": False, "message": str(e)}

def _video_call_status_payload(consultation: dict, appointment: dict | None = None):
    from app.utils.vc_slot_window import slot_window_payload

    status = consultation.get('status') or 'scheduled'
    payload = {
        'success': True,
        'status': status,
        'ended': status in ('completed', 'ended', 'cancelled'),
        'callStartedAt': _call_started_at_ms(consultation),
        'connected': consultation.get('started_at') is not None,
        'consultationId': consultation['id'],
    }
    if appointment is not None:
        window = slot_window_payload(appointment)
        payload['slotWindow'] = window
        payload['forceEnd'] = bool(window.get('forceEnd'))
        payload['softWarn'] = bool(window.get('softWarn'))
        payload['inGrace'] = bool(window.get('inGrace'))
        payload['windowMessage'] = window.get('windowMessage')
        if window.get('forceEnd'):
            payload['ended'] = True
    return payload


async def _maybe_force_end_after_grace(appointment_id: int, appointment: dict, session: dict | None):
    """Server-authoritative end once slot_end + grace has passed."""
    from app.utils.vc_slot_window import slot_window_payload

    window = slot_window_payload(appointment)
    if not window.get('forceEnd'):
        return False
    if session and session.get('status') in ('requested', 'ringing', 'accepted', 'ongoing'):
        await end_video_call_for_appointment(int(appointment_id), {'notes': 'Auto-ended: slot grace period expired'})
        return True
    consultation = await consultation_model.get_consultation_by_appointment_id(int(appointment_id))
    if consultation and (consultation.get('status') or '').lower() in ('scheduled', 'ongoing'):
        await end_video_call_for_appointment(int(appointment_id), {'notes': 'Auto-ended: slot grace period expired'})
        return True
    return False


async def get_video_call_status_for_appointment(appointment_id: int):
    from app.models import call_session_model

    appointment = await appointment_model.get_appointment_by_id(int(appointment_id))
    consultation = await consultation_model.get_consultation_by_appointment_id(int(appointment_id))
    if not consultation:
        return {'success': False, 'message': 'Consultation not found'}

    session = await call_session_model.get_by_appointment(int(appointment_id))
    if appointment:
        try:
            await _maybe_force_end_after_grace(int(appointment_id), appointment, session)
            consultation = await consultation_model.get_consultation_by_appointment_id(int(appointment_id))
            session = await call_session_model.get_by_appointment(int(appointment_id))
        except Exception as e:
            print(f"[WARNING] VC force-end check failed: {e}")

    consultation = await _refresh_consultation(consultation)
    payload = _video_call_status_payload(consultation, appointment)
    # Active call session overrides stale consultation.completed from a prior attempt.
    if session and session.get('status') in ('requested', 'ringing', 'accepted', 'ongoing'):
        window = payload.get('slotWindow') or {}
        if not window.get('forceEnd'):
            payload['ended'] = False
            payload['status'] = session['status']
    return payload


async def sync_call_timer_for_appointment(appointment_id: int):
    """Atomically start the shared call timer when both parties are in the room."""
    consultation = await consultation_model.get_consultation_by_appointment_id(int(appointment_id))
    if not consultation:
        return {'success': False, 'message': 'Consultation not found'}

    status = (consultation.get('status') or '').lower()
    if status == 'ongoing' and not consultation.get('started_at'):
        await db.execute(
            'UPDATE consultations SET started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP '
            'WHERE id = $1 AND started_at IS NULL',
            consultation['id'],
        )

    consultation = await _refresh_consultation(consultation)
    appointment = await appointment_model.get_appointment_by_id(int(appointment_id))
    return _video_call_status_payload(consultation, appointment)


async def end_video_call_for_appointment(appointment_id: int, req_body: dict | None = None):
    """End an active video consultation (either party)."""
    req_body = req_body or {}
    consultation = await consultation_model.get_consultation_by_appointment_id(int(appointment_id))
    if not consultation:
        return {'success': False, 'message': 'Consultation not found'}
    if consultation.get('status') == 'completed':
        return {'success': True, 'message': 'Call already ended', 'ended': True}
    from app.controllers import call_session_controller
    await call_session_controller.mark_completed(int(appointment_id))
    return await end_consultation(
        int(consultation['id']),
        {
            'prescription': req_body.get('prescription'),
            'notes': req_body.get('notes'),
            'prescriptionFile': req_body.get('prescriptionFile'),
        },
    )


async def end_video_call_for_user(user_id: int, appointment_id: int, req_body: dict | None = None):
    appointment = await appointment_model.get_appointment_by_id(int(appointment_id))
    if not appointment or appointment['user_id'] != user_id:
        return {'success': False, 'message': 'Appointment not found'}
    return await end_video_call_for_appointment(appointment_id, req_body)


async def end_video_call_for_doctor(doctor_id: int, appointment_id: int, req_body: dict | None = None):
    appointment = await appointment_model.get_appointment_by_id(int(appointment_id))
    if not appointment or appointment['doctor_id'] != doctor_id:
        return {'success': False, 'message': 'Appointment not found'}
    req_body = req_body or {}
    from app.controllers import call_session_controller, lifecycle_controller
    await call_session_controller.mark_completed(int(appointment_id))
    result = await lifecycle_controller.complete_consultation(
        doctor_id,
        int(appointment_id),
        {
            'prescription': req_body.get('prescription'),
            'notes': req_body.get('notes'),
            'diagnosis': req_body.get('diagnosis'),
            'advice': req_body.get('advice'),
            'followupDate': req_body.get('followupDate') or req_body.get('followup_date'),
            'attachments': req_body.get('attachments') or [],
        },
    )
    if result.get('success'):
        result['ended'] = True
        result['message'] = result.get('message') or 'Consultation ended'
    return result


async def save_consultation_for_doctor(
    doctor_id: int, appointment_id: int, req_body: dict | None = None
):
    from app.controllers import lifecycle_controller

    return await lifecycle_controller.save_consultation_draft(
        doctor_id,
        int(appointment_id),
        req_body or {},
    )


async def get_consultation_for_doctor(doctor_id: int, appointment_id: int):
    """Return the current clinical notes/prescription for a doctor's appointment (for editing)."""
    appointment = await appointment_model.get_appointment_by_id(int(appointment_id))
    if not appointment or appointment['doctor_id'] != doctor_id:
        return {'success': False, 'message': 'Appointment not found'}
    consultation = await consultation_model.get_consultation_by_appointment_id(int(appointment_id))
    c = consultation or {}
    followup = c.get('followup_date')
    attachments = c.get('attachments') or {}
    if isinstance(attachments, str):
        try:
            attachments = json.loads(attachments)
        except Exception:
            attachments = {}
    tablets = ''
    if isinstance(attachments, dict):
        tablets = attachments.get('tablets') or ''
    return {
        'success': True,
        'consultation': {
            'prescription': c.get('prescription') or '',
            'notes': c.get('notes') or '',
            'diagnosis': c.get('diagnosis') or '',
            'advice': c.get('advice') or '',
            'tablets': tablets,
            'followupDate': followup.isoformat() if hasattr(followup, 'isoformat') else (followup or ''),
        },
    }


async def publish_prescription_for_doctor(
    doctor_id: int, appointment_id: int, req_body: dict | None = None
):
    """Save the prescription and send the patient a real-time notification."""
    from app.controllers import lifecycle_controller
    from app.models import prescription_item_model
    import asyncio

    appointment = await appointment_model.get_appointment_by_id(int(appointment_id))
    if not appointment or appointment['doctor_id'] != doctor_id:
        return {'success': False, 'message': 'Appointment not found'}

    # Was there already a prescription? Used to word the notification.
    existing = await consultation_model.get_consultation_by_appointment_id(int(appointment_id))
    had_prescription = bool((existing or {}).get('prescription'))
    if existing:
        try:
            from app.models import prescription_item_model as _pim
            existing_items = await _pim.list_for_consultation(int(existing['id']))
            had_prescription = had_prescription or bool(existing_items)
        except Exception:
            pass

    result = await lifecycle_controller.save_consultation_draft(
        doctor_id,
        int(appointment_id),
        req_body or {},
    )
    if not result.get('success'):
        return result

    # Persist structured line items when provided
    try:
        body = req_body or {}
        items = body.get('items') or body.get('prescriptionItems') or body.get('tablets') or []
        consultation = await consultation_model.get_consultation_by_appointment_id(int(appointment_id))
        if consultation and items:
            # Normalize tablet shape {name, dosage, ...} from doctor UI
            normalized = []
            for t in items:
                if isinstance(t, str):
                    normalized.append({"name": t})
                elif isinstance(t, dict):
                    normalized.append(t)
            await prescription_item_model.replace_for_consultation(
                int(consultation['id']), normalized,
            )
            # Fire pharmacy webhooks
            from app.services import pharmacy_service
            asyncio.create_task(
                pharmacy_service.on_prescription_published(
                    int(consultation['id']),
                    appointment.get('hospital_id'),
                    appointment_id=int(appointment_id),
                    updated=had_prescription,
                )
            )
    except Exception as rx_err:
        print(f"[WARNING] structured prescription save failed: {rx_err}")

    # Notify the patient in real time (FCM push) — non-blocking.
    try:
        doc = await doctor_model.get_doctor_by_id(doctor_id)
        doc_name = (doc.get('name') if doc else None) or 'your doctor'
        doc_name = doc_name.replace('Dr. ', '').replace('Dr.', '').strip() or 'your doctor'
        from app.services import fcm_service
        asyncio.create_task(
            fcm_service.notify_prescription_ready(
                int(appointment['user_id']),
                doc_name,
                int(appointment_id),
                updated=had_prescription,
            )
        )
    except Exception as notify_err:
        print(f"[WARNING] prescription notify failed: {notify_err}")

    result['message'] = 'Prescription updated and patient notified' if had_prescription else 'Prescription sent to patient'
    return result


async def get_video_call_status_for_user(user_id: int, appointment_id: int):
    appointment = await appointment_model.get_appointment_by_id(int(appointment_id))
    if not appointment or appointment['user_id'] != user_id:
        return {'success': False, 'message': 'Appointment not found'}
    return await get_video_call_status_for_appointment(appointment_id)


async def get_video_call_status_for_doctor(doctor_id: int, appointment_id: int):
    appointment = await appointment_model.get_appointment_by_id(int(appointment_id))
    if not appointment or appointment['doctor_id'] != doctor_id:
        return {'success': False, 'message': 'Appointment not found'}
    return await get_video_call_status_for_appointment(appointment_id)


async def sync_call_timer_for_user(user_id: int, appointment_id: int):
    appointment = await appointment_model.get_appointment_by_id(int(appointment_id))
    if not appointment or appointment['user_id'] != user_id:
        return {'success': False, 'message': 'Appointment not found'}
    return await sync_call_timer_for_appointment(appointment_id)


async def sync_call_timer_for_doctor(doctor_id: int, appointment_id: int):
    appointment = await appointment_model.get_appointment_by_id(int(appointment_id))
    if not appointment or appointment['doctor_id'] != doctor_id:
        return {'success': False, 'message': 'Appointment not found'}
    return await sync_call_timer_for_appointment(appointment_id)


async def end_consultation(consultation_id: int, req_body: dict):
    try:
        prescription = req_body.get('prescription')
        notes = req_body.get('notes')
        prescription_file = req_body.get('prescriptionFile')
        
        consultation = await consultation_model.get_consultation_by_id(consultation_id)
        if not consultation:
            return {"success": False, "message": "Consultation not found"}
            
        ended_at = datetime.now()
        started_at = consultation.get('started_at') or ended_at
        duration = round((ended_at - started_at).total_seconds() / 60)
        
        updated = await consultation_model.update_consultation(consultation_id, {
            "status": 'completed',
            "endedAt": ended_at,
            "duration": duration,
            **({
                k: v for k, v in {
                    "prescription": prescription,
                    "notes": notes,
                    "prescriptionFile": prescription_file,
                }.items()
                if v is not None and (not isinstance(v, str) or v.strip())
            }),
        })
        
        # Reset doctor status
        await db.execute('UPDATE doctors SET status = $1, current_appointment_id = NULL WHERE id = $2', 'online', consultation['doctor_id'])
        
        return {"success": True, "consultation": updated}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def get_consultation(consultation_id: int):
    try:
        consultation = await consultation_model.get_consultation_by_id(consultation_id)
        if not consultation:
            return {"success": False, "message": "Consultation not found"}
            
        patient = await user_model.get_user_by_id(consultation['user_id'])
        doctor = await doctor_model.get_doctor_by_id(consultation['doctor_id'])
        
        return {
            "success": True,
            "consultation": {
                **consultation,
                "patientId": {"name": patient['name'], "email": patient['email']} if patient else None,
                "doctorId": {"name": doctor['name'], "speciality": doctor['speciality'], "image": doctor['image']} if doctor else None
            }
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

async def get_user_consultations(user_id: int):
    try:
        consultations = await consultation_model.get_consultations_by_user_id(user_id)
        
        formatted = []
        for c in consultations:
            doctor = await doctor_model.get_doctor_by_id(c['doctor_id'])
            formatted.append({
                **c,
                "doctorId": {"name": doctor['name'], "speciality": doctor['speciality'], "image": doctor['image']} if doctor else None
            })
            
        return {"success": True, "consultations": formatted}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def get_doctor_consultations(doctor_id: int):
    try:
        consultations = await consultation_model.get_consultations_by_doctor_id(doctor_id)
        
        formatted = []
        for c in consultations:
            patient = await user_model.get_user_by_id(c['user_id'])
            formatted.append({
                **c,
                "patientId": {"name": patient['name'], "email": patient['email']} if patient else None
            })
            
        return {"success": True, "consultations": formatted}
    except Exception as e:
        return {"success": False, "message": str(e)}
