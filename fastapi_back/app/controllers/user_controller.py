from typing import Optional
import asyncio
import bcrypt
import json
import os
import time
from datetime import datetime, timedelta
from jose import jwt
from fastapi import HTTPException, UploadFile, File
from app.config.config import settings
from app.services import token_service
from app.models import user_model, doctor_model, appointment_model, health_record_model
from app.utils.formatters import format_user, format_doctor
import cloudinary.uploader
from app.services import email_service, socket_service
from app.config.db import db
from app.services.oauth_verification import (
    OAuthVerificationError,
    extract_id_token_from_body,
    extract_phone_id_token_from_body,
    phone_numbers_match,
    verify_google_id_token,
    verify_firebase_token,
    verify_firebase_phone_token,
)
from app.utils.app_logger import get_logger
from app.utils import password_hash as _ph

log = get_logger(__name__)

async def verify_password(password: str, hashed: str) -> bool:
    return await _ph.verify_password(password, hashed)


async def get_password_hash(password: str) -> str:
    return await _ph.hash_password(password)
# Helper to generate JWT token (legacy callers)
def create_access_token(user_id: int):
    return token_service.create_access_token("patient", user_id=user_id)

# API to register user
async def register_user(req_body: dict):
    try:
        name = req_body.get('name')
        email = req_body.get('email')
        password = req_body.get('password')
        phone = req_body.get('phone')
        gender = req_body.get('gender')
        dob = req_body.get('dob')
        blood_group = req_body.get('bloodGroup') or req_body.get('blood_group')

        if not name or not password or not email:
            return {"success": False, "message": "Missing Details"}

        # Basic validation (Node.js used 'validator')
        if "@" not in email or "." not in email:
            return {"success": False, "message": "Enter a valid email"}

        if len(password) < 8:
            return {"success": False, "message": "Enter a strong password"}

        existing_user = await user_model.get_user_by_email(email)
        if existing_user:
            return {"success": False, "message": "User already exists"}

        from app.utils.contact_uniqueness import phone_taken_in_table, normalize_phone
        if phone and await phone_taken_in_table("users", phone):
            return {
                "success": False,
                "message": "This mobile number is already registered for another patient.",
            }
        if phone:
            phone = normalize_phone(phone) or phone

        # --- Phone verification (Firebase phone OTP) ---
        phone_verified = False
        phone_token = extract_phone_id_token_from_body(req_body)
        if phone_token:
            try:
                claims = verify_firebase_phone_token(phone_token)
            except OAuthVerificationError as phone_err:
                return {"success": False, "message": str(phone_err)}
            if phone and not phone_numbers_match(claims.get("phone_number", ""), phone):
                return {"success": False, "message": "Verified phone number does not match the number entered"}
            # Trust the number proven by the OTP token.
            phone = claims.get("phone_number") or phone
            phone_verified = True
        elif settings.PHONE_VERIFICATION_REQUIRED:
            return {"success": False, "message": "Phone verification required. Please verify your mobile number."}

        hashed_password = await get_password_hash(password)

        # Email may have been verified on the signup form (pre-account OTP).
        from app.utils import password_reset_storage
        email_verified = password_reset_storage.consume_signup_email_verified(email)

        user_data = {
            "name": name,
            "email": email,
            "password": hashed_password,
            "phone": phone,
            "phone_verified": phone_verified,
            "email_verified": email_verified,
            "role": 'patient'
        }
        # Persist the profile details collected during signup so the onboarding
        # step is pre-filled and the user doesn't re-enter what they typed.
        if gender:
            user_data["gender"] = gender
        if dob:
            user_data["dob"] = dob
        if blood_group:
            user_data["bloodGroup"] = blood_group

        new_user = await user_model.create_user(user_data)
        auth_response = await token_service.issue_token_pair(
            "patient",
            user_id=new_user['id'],
            email=new_user.get('email') or email,
            profile={
                "id": new_user["id"],
                "name": new_user.get("name") or name,
                "email": new_user.get("email") or email,
                "image": new_user.get("image"),
            },
        )
        auth_response["isNewUser"] = True

        # --- Welcome Email ---
        try:
            await email_service.send_welcome_email(email, name)
        except Exception as e:
            print(f"[WARNING] Welcome Email failed: {e}")

        return auth_response

    except Exception as e:
        print(f"[ERROR] Register Error: {e}")
        return {"success": False, "message": str(e)}

# API to login user
async def login_user(req_body: dict):
    try:
        email = req_body.get('email')
        password = req_body.get('password')
        
        user = await user_model.get_user_by_email(email)
        if not user:
            return {"success": False, "message": "User does not exist"}

        if await verify_password(password, user['password']):
            auth_response = await token_service.issue_token_pair(
                "patient",
                user_id=user['id'],
                email=user.get('email'),
                profile={
                    "id": user["id"],
                    "name": user.get("name"),
                    "email": user.get("email"),
                    "image": user.get("image"),
                },
            )

            # --- Auto-secure Plain Text password if detected ---
            is_bcrypt = user['password'].startswith('$2b$') or user['password'].startswith('$2a$') or user['password'].startswith('$2y$')
            if not is_bcrypt:
                try:
                    new_hash = await get_password_hash(password)
                    await user_model.update_user_password(user['id'], new_hash)
                    print(f"[SECURITY] Successfully upgraded plain-text password to secure bcrypt hash for user: {email}", flush=True)
                except Exception as hash_err:
                    print(f"[WARNING] Failed to secure user password on login: {hash_err}", flush=True)

            # Login security emails disabled per product policy.

            return auth_response
        else:
            return {"success": False, "message": "Invalid credentials"}

    except Exception as e:
        print(f"[ERROR] Login Error: {e}")
        return {"success": False, "message": str(e)}

# API for social login (Google/Apple/Facebook)
async def social_login(req_body: dict):
    try:
        import secrets
        email = req_body.get('email')
        name = req_body.get('name')
        photo_url = req_body.get('photoURL')
        provider = (req_body.get('provider') or 'google').strip().lower()
        uid = req_body.get('uid')

        social_email_verified = False
        id_token_raw = extract_id_token_from_body(req_body)
        if id_token_raw and provider in ('google', 'firebase'):
            try:
                # App sends a Firebase ID token (works on web + mobile). Fall back
                # to a raw Google OAuth token for older clients / other flows.
                try:
                    claims = verify_firebase_token(id_token_raw)
                except OAuthVerificationError:
                    claims = verify_google_id_token(id_token_raw)
                token_email = claims.get('email')
                if token_email and claims.get('email_verified') is False:
                    return {"success": False, "message": "Email not verified by provider"}
                email = token_email or email
                name = claims.get('name') or name or (email.split('@')[0] if email else '')
                photo_url = claims.get('picture') or photo_url
                uid = claims.get('uid') or claims.get('sub') or uid
                # Provider already verified this email — skip the OTP step.
                social_email_verified = bool(token_email)
            except OAuthVerificationError as oauth_err:
                return {"success": False, "message": str(oauth_err)}
        elif not settings.SOCIAL_LOGIN_ALLOW_LEGACY:
            return {
                "success": False,
                "message": "ID token required for social login. Update the client app or contact support.",
            }
        else:
            log.warning(
                "Social login legacy path used for provider=%s (no idToken verified)",
                provider,
            )

        if not email:
            return {"success": False, "message": "Missing Email"}

        user = await user_model.get_user_by_email(email)
        is_new_user = False

        if not user:
            # Create a new user with a secure random password
            is_new_user = True
            random_pw = secrets.token_hex(16)
            hashed_password = await get_password_hash(random_pw)
            
            user_data = {
                "name": name or email.split('@')[0],
                "email": email,
                "password": hashed_password,
                "image": photo_url,
                "role": 'patient',
                "email_verified": social_email_verified,
            }
            user = await user_model.create_user(user_data)
            
            # --- Welcome Email ---
            try:
                await email_service.send_welcome_email(email, user['name'])
            except Exception as e:
                print(f"[WARNING] Welcome Email failed: {e}")
        else:
            # If user already exists but does not have an avatar/image, update it
            if not user.get('image') and photo_url:
                try:
                    await user_model.update_user(user['id'], {"image": photo_url})
                except Exception as img_err:
                    print(f"[WARNING] Failed to update user image: {img_err}")
            # Provider-verified email — mark verified so they skip the OTP step.
            if social_email_verified and not user.get('email_verified'):
                try:
                    await user_model.set_email_verified(user['id'], True)
                except Exception as ev_err:
                    print(f"[WARNING] Failed to set email_verified: {ev_err}")

        auth_response = await token_service.issue_token_pair(
            "patient",
            user_id=user['id'],
            email=user.get('email') or email,
            profile={
                "id": user["id"],
                "name": user.get("name") or name,
                "email": user.get("email") or email,
                "image": user.get("image") or photo_url,
            },
        )
        auth_response["isNewUser"] = is_new_user

        return auth_response

    except Exception as e:
        print(f"[ERROR] Social Login Error: {e}")
        return {"success": False, "message": str(e)}


# Namespace for email-verification OTPs (kept separate from password reset).
EMAIL_VERIFY_NS = "email_verify"
# Namespace for pre-signup email verification (no account exists yet).
SIGNUP_EMAIL_VERIFY_NS = "signup_email_verify"


async def send_signup_email_otp(email: str):
    """Send a 6-digit OTP to an email during signup (before the account exists)."""
    try:
        import re
        from app.utils import password_reset_storage

        email = (email or "").strip().lower()
        if not email or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            return {"success": False, "message": "Enter a valid email address"}

        existing = await user_model.get_user_by_email(email)
        if existing:
            return {"success": False, "message": "This email is already registered. Please log in."}

        otp = password_reset_storage.generate_otp()
        password_reset_storage.store_otp(SIGNUP_EMAIL_VERIFY_NS, email, otp)
        result = await email_service.send_email_verification_otp(email, otp, "there")
        if result.get("success"):
            return {"success": True, "message": "Verification code sent to your email"}
        if settings.DEBUG:
            return {"success": True, "message": "OTP generated (email delivery failed — dev)", "dev_otp": otp}
        return {"success": False, "message": result.get("message") or "Failed to send verification email"}
    except Exception as e:
        print(f"[ERROR] Send Signup Email OTP Error: {e}")
        return {"success": False, "message": str(e)}


async def verify_signup_email_otp(email: str, otp: str):
    """Verify a signup email OTP and remember the email as verified for registration."""
    try:
        import re
        from app.utils import password_reset_storage

        email = (email or "").strip().lower()
        if not email:
            return {"success": False, "message": "Email is required"}
        if not otp or not re.match(r"^\d{6}$", str(otp)):
            return {"success": False, "message": "Please enter a valid 6-digit code"}

        result = password_reset_storage.verify_otp(SIGNUP_EMAIL_VERIFY_NS, email, str(otp), consume=True)
        if not result.get("success"):
            return {"success": False, "message": result.get("message", "Invalid code")}

        password_reset_storage.mark_signup_email_verified(email)
        return {"success": True, "message": "Email verified"}
    except Exception as e:
        print(f"[ERROR] Verify Signup Email OTP Error: {e}")
        return {"success": False, "message": str(e)}


async def send_email_verification(user_id: int):
    """Send a 6-digit OTP to the logged-in user's email to verify it."""
    try:
        from app.utils import password_reset_storage

        user = await user_model.get_user_by_id(user_id)
        if not user:
            return {"success": False, "message": "User not found"}
        email = (user.get('email') or '').strip().lower()
        if not email:
            return {"success": False, "message": "No email on file"}
        if user.get('email_verified'):
            return {"success": True, "message": "Email already verified", "alreadyVerified": True}

        otp = password_reset_storage.generate_otp()
        password_reset_storage.store_otp(EMAIL_VERIFY_NS, email, otp)
        result = await email_service.send_email_verification_otp(email, otp, user.get('name') or 'User')
        if result.get('success'):
            return {"success": True, "message": "Verification code sent to your email"}
        if settings.DEBUG:
            return {"success": True, "message": "OTP generated (email delivery failed — dev)", "dev_otp": otp}
        return {"success": False, "message": result.get('message') or "Failed to send verification email"}
    except Exception as e:
        print(f"[ERROR] Send Email Verification Error: {e}")
        return {"success": False, "message": str(e)}


async def verify_email(user_id: int, otp: str):
    """Verify the OTP and mark the user's email as verified."""
    try:
        import re
        from app.utils import password_reset_storage

        user = await user_model.get_user_by_id(user_id)
        if not user:
            return {"success": False, "message": "User not found"}
        if user.get('email_verified'):
            return {"success": True, "message": "Email already verified"}
        email = (user.get('email') or '').strip().lower()
        if not otp or not re.match(r"^\d{6}$", str(otp)):
            return {"success": False, "message": "Please enter a valid 6-digit code"}

        result = password_reset_storage.verify_otp(EMAIL_VERIFY_NS, email, str(otp), consume=True)
        if not result.get('success'):
            return {"success": False, "message": result.get('message', 'Invalid code')}

        updated = await user_model.set_email_verified(user_id, True)
        return {"success": True, "message": "Email verified", "userData": format_user(updated)}
    except Exception as e:
        print(f"[ERROR] Verify Email Error: {e}")
        return {"success": False, "message": str(e)}

# API to get user profile
async def get_profile(user_id: int):
    try:
        if not user_id or user_id < 0:
            return {"success": False, "message": "Invalid Session. Please login again."}

        user = await user_model.get_user_by_id(user_id)
        if not user:
            return {"success": False, "message": "User not found"}
            
        return {"success": True, "userData": format_user(user)}
    except Exception as e:
        print(f"[ERROR] Get Profile Error: {e}")
        return {"success": False, "message": str(e)}

# API to update user profile
async def update_profile(user_id: int, form_data: dict, image_file: Optional[UploadFile] = None):
    try:
        if not user_id or user_id < 0:
            return {"success": False, "message": "Invalid Session. Please login again."}

        update_data = {}

        def _present(value) -> bool:
            if value is None:
                return False
            if isinstance(value, str) and not value.strip():
                return False
            return True

        # Only apply fields the client actually sent (photo-only upload must not null out name).
        if _present(form_data.get('name')):
            update_data['name'] = form_data['name'].strip() if isinstance(form_data['name'], str) else form_data['name']
        if _present(form_data.get('phone')):
            update_data['phone'] = form_data['phone'].strip() if isinstance(form_data['phone'], str) else form_data['phone']
        if _present(form_data.get('gender')):
            update_data['gender'] = form_data['gender']
        if _present(form_data.get('bloodGroup')):
            update_data['bloodGroup'] = form_data['bloodGroup']

        if _present(form_data.get('address')):
            addr = form_data['address']
            if isinstance(addr, str) and addr.strip():
                try:
                    update_data['address'] = json.loads(addr)
                except json.JSONDecodeError:
                    update_data['address_line1'] = addr
            elif isinstance(addr, dict):
                update_data['address'] = addr

        # Calculate age if dob updated
        dob = form_data.get('dob')
        if dob and dob not in ['Not Selected', 'dd-mm-yyyy']:
            update_data['dob'] = dob
            try:
                birth_date = datetime.strptime(dob, "%Y-%m-%d")
                today = datetime.today()
                age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
                update_data['age'] = age
            except:
                pass

        if image_file:
            file_content = await image_file.read()
            if not file_content:
                return {"success": False, "message": "Empty image file"}
            user = await user_model.get_user_by_id(user_id)
            from app.services.cloudinary_folders import patient_profile_folder

            upload_result = cloudinary.uploader.upload(
                file_content,
                folder=patient_profile_folder(user, user_id=user_id),
                resource_type="image",
            )
            update_data["image"] = upload_result.get("secure_url")

        if not update_data:
            user = await user_model.get_user_by_id(user_id)
            return {
                "success": True,
                "message": "No changes",
                "userData": format_user(user),
                "profile_pic_url": (user or {}).get("image"),
            }

        await user_model.update_user(user_id, update_data)
        user = await user_model.get_user_by_id(user_id)
        formatted = format_user(user)
        return {
            "success": True,
            "message": "Profile Updated",
            "userData": formatted,
            "profile_pic_url": formatted.get("image") if formatted else None,
        }

    except Exception as e:
        print(f"[ERROR] Update Profile Error: {e}")
        return {"success": False, "message": str(e)}


async def patch_profile(user_id: int, body: dict):
    """JSON profile update — optional fields only."""
    try:
        if not user_id or user_id < 0:
            return {"success": False, "message": "Invalid Session. Please login again."}

        update_data = {}
        field_map = {
            "name": "name",
            "phone": "phone",
            "gender": "gender",
            "dob": "dob",
            "blood_group": "bloodGroup",
            "bloodGroup": "bloodGroup",
            "medical_history": "medical_history",
            "allergies": "allergies",
        }
        for key, model_key in field_map.items():
            if key in body and body[key] is not None and body[key] != "":
                update_data[model_key] = body[key]

        if "address" in body and body["address"] is not None:
            addr = body["address"]
            if isinstance(addr, str) and addr.strip():
                update_data["address"] = {"line1": addr.strip(), "line2": ""}
            elif isinstance(addr, dict):
                update_data["address"] = {
                    "line1": addr.get("line1") or "",
                    "line2": addr.get("line2") or "",
                }

        if not update_data:
            user = await user_model.get_user_by_id(user_id)
            return {"success": True, "userData": format_user(user)}

        await user_model.update_user(user_id, update_data)
        user = await user_model.get_user_by_id(user_id)
        return {"success": True, "userData": format_user(user)}
    except Exception as e:
        print(f"[ERROR] Patch Profile Error: {e}")
        return {"success": False, "message": str(e)}


async def patch_onboarding(user_id: int, body: dict):
    """Persist onboarding progress flags for MEDCLUES first-time flow."""
    try:
        if not user_id or user_id < 0:
            return {"success": False, "message": "Invalid Session. Please login again."}

        update_data = {}
        bool_map = {
            "onboardingCompleted": "onboardingCompleted",
            "tutorialCompleted": "tutorialCompleted",
            "emergencyContactCompleted": "emergencyContactCompleted",
            "profileCompleted": "profileCompleted",
        }
        for key, model_key in bool_map.items():
            if key in body:
                update_data[model_key] = bool(body[key])

        if "onboardingStep" in body and body["onboardingStep"] is not None:
            try:
                update_data["onboardingStep"] = int(body["onboardingStep"])
            except (TypeError, ValueError):
                pass

        if not update_data:
            user = await user_model.get_user_by_id(user_id)
            return {"success": True, "userData": format_user(user)}

        await user_model.update_user(user_id, update_data)
        user = await user_model.get_user_by_id(user_id)
        return {"success": True, "userData": format_user(user)}
    except Exception as e:
        print(f"[ERROR] Patch Onboarding Error: {e}")
        return {"success": False, "message": str(e)}

# --- Appointment Logic ---

from app.services import queue_service, email_service
import razorpay
import hmac
import hashlib

razorpay_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


async def _resolve_booking_hospital_location(
    doc_data: dict,
    frontend_hospital_name: Optional[str] = None,
    frontend_location: Optional[str] = None,
) -> tuple[str, str, Optional[float], Optional[float]]:
    """Return (hospital_name, full_address, latitude, longitude)."""
    hospital_name = (
        (frontend_hospital_name or "").strip()
        or (doc_data.get("hospital_name") or "").strip()
        or "MEDCLUES Partner Hospital"
    )

    doctor_address = ", ".join(
        p
        for p in [
            (doc_data.get("address_line1") or "").strip(),
            (doc_data.get("address_line2") or "").strip(),
        ]
        if p
    )

    tieup_name = None
    tieup_address = None
    hosp_lat = None
    hosp_lng = None

    hosp_id = doc_data.get("hospital_id")
    if hosp_id:
        tieup = await db.fetch_row(
            "SELECT name, address FROM hospital_tieups WHERE id = $1", hosp_id
        )
        if tieup:
            tieup_name = (tieup.get("name") or "").strip()
            tieup_address = (tieup.get("address") or "").strip()
        else:
            hosp = await db.fetch_row(
                """
                SELECT name, address_line1, address_line2, latitude, longitude
                FROM hospitals WHERE id = $1
                """,
                hosp_id,
            )
            if hosp:
                tieup_name = (hosp.get("name") or "").strip()
                tieup_address = ", ".join(
                    p.strip()
                    for p in [hosp.get("address_line1"), hosp.get("address_line2")]
                    if p and str(p).strip()
                )
                hosp_lat = hosp.get("latitude")
                hosp_lng = hosp.get("longitude")

    if tieup_name and hospital_name == "MEDCLUES Partner Hospital":
        hospital_name = tieup_name

    full_address = (frontend_location or "").strip()
    if not full_address:
        full_address = tieup_address or doctor_address
    if not full_address:
        full_address = hospital_name

    lat_val: Optional[float] = None
    lng_val: Optional[float] = None
    if hosp_lat is not None and hosp_lng is not None:
        try:
            lat_val = float(hosp_lat)
            lng_val = float(hosp_lng)
            if lat_val == 0.0 and lng_val == 0.0:
                lat_val = lng_val = None
        except (TypeError, ValueError):
            lat_val = lng_val = None

    return hospital_name, full_address, lat_val, lng_val


async def _send_booking_confirmation_email(
    *,
    user_email: str,
    actual_patient: dict,
    user_name: str,
    doc_data: dict,
    slot_date: str,
    slot_time: str,
    amount,
    token_number,
    appointment_id,
    frontend_hospital_name: Optional[str],
    frontend_location: Optional[str],
    appointment_public_id: Optional[str] = None,
    booking_id: Optional[str] = None,
):
    try:
        email_details = {
            "patientName": actual_patient.get('name') if not actual_patient.get('isSelf') else user_name,
            "doctorName": doc_data['name'],
            "speciality": doc_data.get('speciality')
                or doc_data.get('specialty')
                or doc_data.get('specialization')
                or 'General Medicine',
            "date": slot_date.replace('_', '/'),
            "time": slot_time,
            "fee": amount,
            "tokenNumber": token_number,
            "publicId": appointment_public_id or None,
            "bookingId": booking_id or None,
        }

        hospital_name, hospital_location_str, hosp_lat, hosp_lng = await _resolve_booking_hospital_location(
            doc_data,
            frontend_hospital_name=frontend_hospital_name,
            frontend_location=frontend_location,
        )

        from app.utils.mobile_links import appointment_email_link, maps_email_link

        email_details["hospitalName"] = hospital_name
        email_details["hospitalLocation"] = hospital_location_str
        email_details["viewUrl"] = appointment_email_link(appointment_id)
        email_details["appointmentId"] = appointment_id
        email_details["mapsLink"] = maps_email_link(
            hospital_name, hospital_location_str, hosp_lat, hosp_lng
        )

        email_res = await email_service.send_appointment_confirmation(user_email, email_details)
        if not email_res.get('success'):
            print(f"[WARNING] Email delivery failed: {email_res.get('message')}")
    except Exception as email_err:
        print(f"[WARNING] Email trigger error: {email_err}")


async def _send_booking_telegram_notification(
    *,
    user_id: int,
    actual_patient: dict,
    user_name: str,
    doc_data: dict,
    slot_date: str,
    slot_time: str,
    token_number,
    appointment_id: int,
    frontend_hospital_name: Optional[str],
    frontend_location: Optional[str],
    appointment_public_id: Optional[str] = None,
):
    try:
        from app.services import telegram_notify_service

        patient_name = actual_patient.get("name") if not actual_patient.get("isSelf") else user_name
        hospital_name, hospital_location, hosp_lat, hosp_lng = await _resolve_booking_hospital_location(
            doc_data,
            frontend_hospital_name=frontend_hospital_name,
            frontend_location=frontend_location,
        )

        from app.utils.mobile_links import maps_geo_url

        maps_url = maps_geo_url(hospital_name, hospital_location, hosp_lat, hosp_lng)

        await telegram_notify_service.notify_appointment_booked(
            user_id,
            patient_name=patient_name,
            doctor_name=doc_data.get("name", "Doctor"),
            speciality=doc_data.get("speciality", ""),
            slot_date=slot_date,
            slot_time=slot_time,
            token_number=token_number,
            hospital_name=hospital_name,
            hospital_location=hospital_location,
            appointment_id=int(appointment_id),
            appointment_public_id=appointment_public_id,
            maps_url=maps_url,
        )
    except Exception as tg_err:
        print(f"[WARNING] Telegram booking notify: {tg_err}")


async def book_appointment(user_id: int, req_body: dict, prescription_file: Optional[UploadFile] = None):
    try:
        from app.utils.ownership import reject_client_user_override
        from app.services.appointment_lifecycle_service import (
            assert_can_book,
            AppointmentPolicyError,
        )
        from app.services import trust_score_service

        override_err = reject_client_user_override(req_body, user_id)
        if override_err:
            return override_err

        admin_override = bool(req_body.get("adminOverride"))
        actual_patient = req_body.get('actualPatient') or {"isSelf": True}
        try:
            await assert_can_book(
                user_id,
                admin_override=admin_override,
                actual_patient=actual_patient,
            )
        except AppointmentPolicyError as exc:
            return {"success": False, "message": exc.message}

        payment_method_early = req_body.get("paymentMethod") or "payOnVisit"
        constraints = await trust_score_service.booking_constraints(user_id)
        if constraints.get("advancePaymentRequired") and payment_method_early.lower() in (
            "payonvisit",
            "cash",
            "",
        ):
            return {
                "success": False,
                "message": "Advance online payment is required for your account.",
                "advancePaymentRequired": True,
            }

        doc_id = req_body.get('docId')
        db_doc_id = doc_id
        if isinstance(doc_id, str):
            if doc_id.startswith('emb_'):
                try:
                    db_doc_id = int(doc_id.replace('emb_', ''))
                except ValueError:
                    return {"success": False, "message": "Invalid doctor id format"}
            else:
                try:
                    db_doc_id = int(doc_id)
                except ValueError:
                    pass
        slot_date = req_body.get('slotDate')
        slot_time = req_body.get('slotTime')
        symptoms = req_body.get('symptoms') or []
        payment_method = req_body.get('paymentMethod') or 'payOnVisit'
        frontend_hospital_name = req_body.get('hospitalName')
        frontend_location = req_body.get('location')

        # Handle prescription upload
        prescription_url = None
        prescription_data = None
        if prescription_file:
            try:
                from app.services.cloudinary_folders import patient_reports_folder
                from app.utils.upload_safe import (
                    UploadRejected,
                    cloudinary_upload_bytes,
                    read_upload_limited,
                )

                user_row = await user_model.get_user_by_id(user_id)
                try:
                    file_content, fname, ctype = await read_upload_limited(prescription_file)
                except UploadRejected as ure:
                    return {"success": False, "message": ure.message}
                upload_result = await cloudinary_upload_bytes(
                    file_content,
                    folder=patient_reports_folder(user_row, user_id=user_id),
                    resource_type="auto",
                )
                prescription_url = upload_result.get('secure_url')
                
                # Store data for health record creation
                prescription_data = {
                    "url": prescription_url,
                    "fileName": fname,
                    "fileSize": len(file_content),
                    "fileType": (ctype or "unknown").split('/')[-1],
                    "cloudinaryPublicId": upload_result.get('public_id')
                }
            except Exception as e:
                print(f"[WARNING] Prescription Upload Error: {e}")

        doc_data = await doctor_model.get_doctor_by_id(doc_id)
        if not doc_data:
            return {"success": False, "message": "Doctor not found"}

        if not doc_data.get('available'):
            return {"success": False, "message": "Doctor not available"}

        from app.services import doctor_slot_service
        from app.models import doctor_slot_model

        doctor_ref, _ = doctor_slot_service.normalize_doctor_ref(doc_id)
        await doctor_slot_service.ensure_doctor_slots_for_doctor(doctor_ref)

        slot_id_raw = req_body.get('slotId') or req_body.get('slot_id')
        booking_mode_req = doctor_slot_service.normalize_booking_mode(
            req_body.get('mode') or req_body.get('visitType')
        )
        slot_type_req = doctor_slot_service.infer_slot_type_from_label(
            slot_time,
            req_body.get('slotType') or req_body.get('slot_type'),
        )
        resolved_slot = None
        booked_slot_id = None

        wants_slot = bool(
            slot_id_raw
            or booking_mode_req in ("offline", "online")
            or slot_type_req in ("morning_opd", "evening_opd", "video")
        )
        if wants_slot:
            resolved_slot, slot_err = await doctor_slot_service.resolve_slot_for_booking(
                doctor_ref,
                int(slot_id_raw) if slot_id_raw else None,
                booking_mode_req,
                slot_type_req,
                slot_date,
            )
            if slot_err:
                return {"success": False, "message": slot_err}
            from app.services import slot_capacity_service

            cap_doc_id = int(resolved_slot.get("doctor_numeric_id") or db_doc_id)
            cap_err = await slot_capacity_service.assert_capacity_available(
                cap_doc_id,
                resolved_slot,
                slot_date_str=slot_date,
            )
            if cap_err:
                # resolve_slot_for_booking already claimed the row — release on capacity fail
                try:
                    await doctor_slot_model.release_slot(int(resolved_slot["id"]))
                except Exception:
                    pass
                return {"success": False, "message": cap_err}
            # Slot already claimed atomically inside resolve_slot_for_booking
            booked_slot_id = int(resolved_slot['id'])
            slot_date = doctor_slot_service.legacy_slot_date(resolved_slot['slot_date'])
            slot_time = doctor_slot_service.slot_time_label(resolved_slot)

        # Legacy slots_booked sync (queue compatibility)
        slots_booked = doc_data.get('slots_booked', {})
        if isinstance(slots_booked, str):
            slots_booked = json.loads(slots_booked)
        is_opd_block = slot_type_req in ("morning_opd", "evening_opd") or (
            doctor_slot_service.infer_slot_type_from_label(slot_time) is not None
        )

        if booked_slot_id:
            # doctor_slots is source of truth — allow multiple bookings per OPD block label
            if slot_date not in slots_booked:
                slots_booked[slot_date] = []
            marker = f"slot:{booked_slot_id}"
            if marker not in slots_booked[slot_date]:
                slots_booked[slot_date].append(marker)
        elif is_opd_block:
            # OPD blocks hold 20 seats in doctor_slots — never reject on legacy block label
            if not wants_slot:
                return {
                    "success": False,
                    "message": "Please select a valid OPD time slot.",
                }
        elif slot_date in slots_booked:
            if slot_time in slots_booked[slot_date]:
                return {"success": False, "message": "Slot not available"}
            slots_booked[slot_date].append(slot_time)
        else:
            slots_booked[slot_date] = [slot_time]

        if isinstance(doc_id, (int, float)) or (isinstance(doc_id, str) and not doc_id.startswith('emb_')):
            try:
                await doctor_model.update_doctor(int(doc_id), {"slots_booked": slots_booked})
            except Exception:
                pass
        else:
            try:
                actual_id = int(str(doc_id).replace('emb_', ''))
                await db.execute(
                    'UPDATE hospital_tieup_doctors SET slots_booked = $1 WHERE id = $2',
                    json.dumps(slots_booked),
                    actual_id,
                )
            except Exception:
                pass

        user_data = await user_model.get_user_by_id(user_id)
        
        # Queue Logic
        queue_data = await queue_service.calculate_queue_position(doc_id, slot_date)
        token_number = await queue_service.assign_token_number(doc_id, slot_date)

        # Merge prescription URL into actual patient info if provided
        if prescription_url:
            actual_patient['prescription'] = prescription_url

        # Persist the uploaded report on the appointment snapshot (userData JSON is
        # stored/returned) so the doctor can view it during the consultation.
        booking_user_data = format_user(user_data) or {}
        if prescription_url:
            booking_user_data['bookingReportUrl'] = prescription_url

        visit_type = (req_body.get('visitType') or req_body.get('visit_type') or '').strip()
        mode = req_body.get('mode')
        if resolved_slot:
            mode = doctor_slot_service.appointment_mode_from_slot(resolved_slot)
        elif not mode:
            mode = doctor_slot_service.normalize_appointment_mode_for_db(
                'online' if visit_type.lower() in ('online', 'video') else 'offline'
            )
        mode = doctor_slot_service.normalize_appointment_mode_for_db(mode)

        mode_lower = str(mode).lower()
        if mode_lower in ('online', 'video') and payment_method.lower() in ('payonvisit', 'cash', ''):
            if booked_slot_id:
                await doctor_slot_model.release_slot(booked_slot_id)
            return {"success": False, "message": "Video consultation requires online payment."}

        fee_amount = (
            doctor_slot_service.consultation_fee_for_mode(doc_data, 'online')
            if mode_lower in ('online', 'video')
            else doctor_slot_service.consultation_fee_for_mode(doc_data, 'offline')
        )

        from app.models.appointment_model import generate_unique_booking_id
        booking_id = await generate_unique_booking_id()

        appointment_data = {
            "userId": user_id,
            "docId": db_doc_id,
            "userData": booking_user_data,
            "docData": format_doctor(doc_data),
            "amount": fee_amount,
            "consultationFee": fee_amount,
            "slotDate": slot_date,
            "slotTime": slot_time,
            "actualPatient": actual_patient,
            "selectedSymptoms": symptoms,
            "paymentMethod": payment_method,
            "mode": mode,
            "tokenNumber": token_number,
            "queuePosition": queue_data.get('queuePosition'),
            "estimatedWaitTime": queue_data.get('estimated_wait_time'),
            "status": 'pending',
            "bookingId": booking_id,
            "slotId": booked_slot_id,
            "source": "ONLINE",
        }

        try:
            new_appointment = await appointment_model.create_appointment(appointment_data)
        except Exception as create_err:
            if booked_slot_id:
                await doctor_slot_model.release_slot(booked_slot_id)
            raise create_err

        try:
            from app.controllers.doctor_slot_controller import invalidate_slots_cache
            invalidate_slots_cache(str(db_doc_id))
        except Exception:
            pass

        try:
            from app.models import hospital_policy_model
            from app.services import appointment_lifecycle_service

            policy = await hospital_policy_model.get_policy_for_doctor(
                int(db_doc_id) if isinstance(db_doc_id, int) else db_doc_id
            )
            paid_now = payment_method.lower() in (
                "razorpay",
                "onlinepayment",
                "online",
            )
            await appointment_lifecycle_service.apply_booking_defaults(
                int(new_appointment["id"]),
                hospital_id=doc_data.get("hospital_id"),
                validity_days=int(policy.get("validity_days") or 7),
                max_visits=int(policy.get("max_visits") or 3),
                followup_visits_max=int(policy.get("followup_visits") or 1),
                paid_at_booking=paid_now,
            )
            if paid_now:
                await appointment_lifecycle_service.mark_paid_confirmed(
                    int(new_appointment["id"])
                )
        except Exception as lifecycle_err:
            print(f"[WARNING] Lifecycle defaults: {lifecycle_err}")

        # --- Automatic Health Record Creation ---
        # If a prescription was uploaded during booking, create a health record for it 
        # so the doctor can see it in the Patient Reports section.
        if prescription_url and prescription_data:
            try:
                record_title = f"Prescription for {doc_data['name']} Appointment"
                record_payload = {
                    "userId": user_id,
                    "docId": db_doc_id,
                    "appointmentId": new_appointment['id'],
                    "recordType": 'Prescription',
                    "title": record_title,
                    "description": f"Uploaded during appointment booking on {slot_date}",
                    "doctorName": doc_data['name'],
                    "date": datetime.now(),
                    "files": [prescription_data],
                    "tags": ['Autogenerated', 'Appointment'],
                    "isImportant": True,
                    "uploadedBeforeAppointment": True
                }
                await health_record_model.create_health_record(record_payload)
            except Exception as record_err:
                print(f"[WARNING] Failed to autogenerate health record from prescription: {record_err}")

        saved_booking_id = new_appointment.get('booking_id') or booking_id

        # Email runs in background so booking response is not blocked (~3–8s on Brevo).
        asyncio.create_task(_send_booking_confirmation_email(
            user_email=user_data['email'],
            actual_patient=actual_patient,
            user_name=user_data['name'],
            doc_data=doc_data,
            slot_date=slot_date,
            slot_time=slot_time,
            amount=appointment_data['amount'],
            token_number=token_number,
            appointment_id=new_appointment['id'],
            frontend_hospital_name=frontend_hospital_name,
            frontend_location=frontend_location,
            appointment_public_id=new_appointment.get('public_id'),
            booking_id=saved_booking_id,
        ))
        asyncio.create_task(_send_booking_telegram_notification(
            user_id=user_id,
            actual_patient=actual_patient,
            user_name=user_data['name'],
            doc_data=doc_data,
            slot_date=slot_date,
            slot_time=slot_time,
            token_number=token_number,
            appointment_id=new_appointment['id'],
            frontend_hospital_name=frontend_hospital_name,
            frontend_location=frontend_location,
            appointment_public_id=new_appointment.get('public_id'),
        ))

        # Trigger Real-time update for Admin Dashboard
        await socket_service.emit_new_appointment({
            "_id": new_appointment['id'],
            "docData": format_doctor(doc_data),
            "userData": format_user(user_data),
            "amount": appointment_data['amount'],
            "slotDate": slot_date,
            "slotTime": slot_time,
            "actualPatient": actual_patient
        })

        try:
            from app.services import fcm_service
            asyncio.create_task(
                fcm_service.notify_appointment_booked(
                    user_id,
                    doc_data.get('name', 'Doctor'),
                    slot_date,
                    slot_time,
                    int(new_appointment['id']),
                )
            )
        except Exception as push_err:
            print(f"[WARNING] FCM booking push: {push_err}")

        return {
            "success": True,
            "message": "Appointment Booked",
            "appointmentId": new_appointment['id'],
            "publicId": new_appointment.get('public_id'),
            "bookingId": saved_booking_id,
            "tokenNumber": token_number,
            "queuePosition": queue_data.get('queuePosition'),
            "estimatedWaitTime": queue_data.get('estimated_wait_time'),
            "bookingConstraints": constraints,
        }

    except Exception as e:
        print(f"[ERROR] Book Appointment Error: {e}")
        err = str(e)
        if "no unique or exclusion constraint" in err.lower():
            return {
                "success": False,
                "message": "Booking is temporarily unavailable while slot indexes are repaired. Please try again in a moment.",
            }
        return {"success": False, "message": err}

async def list_appointments(
    user_id: int,
    *,
    limit: int | None = None,
    offset: int = 0,
):
    try:
        from app.utils.pagination import pagination_meta, with_pagination

        from app.services import appointment_lifecycle_service
        from app.services import appointment_summary_service

        total = await appointment_model.count_appointments_by_user_id(user_id)
        appointments = await appointment_model.get_appointments_by_user_id(
            user_id, limit=limit, offset=offset
        )
        
        # JS expects specifically formatted objects
        formatted = []
        for apt in appointments:
            user_data = apt['user_data'] if isinstance(apt['user_data'], dict) else (
                json.loads(apt['user_data']) if apt.get('user_data') else {}
            )
            if not isinstance(user_data, dict):
                user_data = {}
            doc_data = apt['doctor_data'] if isinstance(apt['doctor_data'], dict) else (
                json.loads(apt['doctor_data']) if apt.get('doctor_data') else {}
            )
            if not isinstance(doc_data, dict):
                doc_data = {}

            is_self = apt.get('actual_patient_is_self')
            if is_self is None:
                is_self = True
            patient_name = (apt.get('actual_patient_name') or '').strip()
            if not patient_name and bool(is_self):
                patient_name = (user_data.get('name') or '').strip()
            actual_patient = {
                "name": patient_name,
                "age": apt.get('actual_patient_age') or '',
                "gender": apt.get('actual_patient_gender') or '',
                "relationship": apt.get('actual_patient_relationship') or '',
                "phone": apt.get('actual_patient_phone') or '',
                "isSelf": bool(is_self),
            }

            formatted.append({
                "_id": apt['id'],
                "id": apt['id'],
                "docId": apt['doctor_id'],
                "userId": apt['user_id'],
                "slotDate": apt['slot_date'],
                "slotTime": apt['slot_time'],
                "userData": user_data,
                "docData": doc_data,
                "actualPatient": actual_patient,
                "patientName": patient_name,
                "amount": float(apt['amount']),
                "date": apt['date'],
                "cancelled": bool(apt.get('cancelled')),
                "payment": apt['payment'],
                "isCompleted": apt['is_completed'],
                "status": apt['status'],
                "paymentMethod": apt['payment_method'],
                "mode": apt.get('mode'),
                "visitType": (
                    'Online' if str(apt.get('mode') or '').lower() in ('online', 'video')
                    else 'In-clinic'
                ),
                "tokenNumber": apt['token_number'],
                "publicId": apt.get('public_id'),
                "bookingId": apt.get('booking_id'),
                "queuePosition": apt['queue_position'],
                "estimatedWaitTime": apt['estimated_wait_time'],
                "summaryQrUrl": (
                    (
                        bool(apt.get('is_completed'))
                        or str(apt.get('lifecycle_status') or '').upper() == 'COMPLETED'
                    )
                    and appointment_summary_service.summary_qr_url_for_booking(apt.get('booking_id'))
                ) or None,
                **appointment_lifecycle_service.lifecycle_payload(apt),
            })
        payload = {"success": True, "appointments": formatted}
        return with_pagination(
            payload,
            pagination_meta(
                total=total,
                limit=limit,
                offset=offset,
                returned=len(formatted),
            ),
        )
    except Exception as e:
        log.error("List appointments error: %s", e)
        return {"success": False, "message": str(e)}

async def cancel_appointment(user_id: int, appointment_id: int):
    try:
        from app.controllers import lifecycle_controller

        result = await lifecycle_controller.cancel_with_policy(
            user_id,
            int(appointment_id),
            reason="Cancelled by user",
        )
        if not result.get("success"):
            return result

        # Release seat before responding so available_count is fresh on next fetch.
        await _post_cancel_cleanup(user_id, int(appointment_id))

        return {
            "success": True,
            "message": "Appointment Cancelled",
            "refund": result.get("refund"),
            "lifecycle": result.get("lifecycle"),
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


async def _post_cancel_cleanup(user_id: int, appointment_id: int):
    """Free the slot, update legacy maps and notify — all off the request path."""
    try:
        appointment = await appointment_model.get_appointment_by_id(int(appointment_id))
        if not appointment:
            return

        doc_id = appointment['doctor_id']
        try:
            from app.services import doctor_slot_service
            await doctor_slot_service.release_slot_for_appointment(appointment)
        except Exception as slot_err:
            print(f"[WARNING] Slot release on user cancel: {slot_err}")

        doc_data = await doctor_model.get_doctor_by_id(doc_id)
        if doc_data:
            slots_booked = doc_data.get('slots_booked', {})
            if isinstance(slots_booked, str): slots_booked = json.loads(slots_booked)

            date = appointment['slot_date']
            time_str = appointment['slot_time']
            slot_id = appointment.get('slot_id')

            if date in slots_booked:
                if slot_id:
                    marker = f"slot:{slot_id}"
                    if marker in slots_booked[date]:
                        slots_booked[date].remove(marker)
                if time_str in slots_booked[date]:
                    slots_booked[date].remove(time_str)
                await doctor_model.update_doctor(doc_id, {"slots_booked": slots_booked})

        from app.services.socket_service import sio
        await sio.emit('appointments-deleted', {'id': appointment_id})

        user_data = await user_model.get_user_by_id(user_id)
        doc_name = (doc_data or {}).get("name") or "your doctor"

        try:
            from app.services import fcm_service
            await fcm_service.notify_appointment_cancelled(
                user_id, doc_name, int(appointment_id)
            )
        except Exception as push_err:
            print(f"[WARNING] FCM cancel push: {push_err}")

        try:
            if user_data and user_data.get("email"):
                cancel_details = {
                    "doctorName": doc_name if doc_data else "Doctor",
                    "date": str(appointment.get("slot_date", "")).replace("_", "/"),
                    "time": appointment.get("slot_time", ""),
                    "tokenNumber": appointment.get("token_number", "N/A"),
                    "publicId": appointment.get("public_id") or None,
                    "bookingId": appointment.get("booking_id") or None,
                }
                await email_service.send_appointment_cancelled(
                    user_data["email"],
                    user_data.get("name", "Patient"),
                    cancel_details,
                    reason="Cancelled by user",
                )
        except Exception as email_err:
            print(f"[WARNING] Cancel email failed: {email_err}")

        try:
            from app.services import telegram_notify_service
            if user_data:
                await telegram_notify_service.notify_appointment_cancelled(
                    user_id,
                    doc_name if doc_data else "Doctor",
                    str(appointment.get("slot_date", "")),
                    user_data.get("name", "Patient"),
                    reason="Cancelled by user",
                )
        except Exception as tg_err:
            print(f"[WARNING] Telegram cancel notify: {tg_err}")
    except Exception as e:
        print(f"[WARNING] post-cancel cleanup failed: {e}")

# --- Razorpay Payment (legacy helpers — prefer payments_controller) ---

async def payment_razorpay(appointment_id: int):
    """Delegate to payments_controller: appointments.amount is INR → paise once."""
    from app.controllers import payments_controller
    return await payments_controller.create_order_for_existing_appointment(appointment_id)

async def verify_razorpay(req_body: dict, user_id: Optional[int] = None):
    try:
        from app.controllers import payments_controller
        return await payments_controller.verify_appointment_payment(
            user_id=user_id,
            razorpay_order_id=req_body.get('razorpay_order_id'),
            razorpay_payment_id=req_body.get('razorpay_payment_id'),
            razorpay_signature=req_body.get('razorpay_signature'),
            appointment_id=req_body.get('appointmentId') or req_body.get('appointment_id'),
        )
    except Exception as e:
        return {"success": False, "message": str(e)}

# --- Forgot Password ---

import random

async def forgot_password(email: str):
    try:
        user = await user_model.get_user_by_email(email)
        if not user:
            return {"success": False, "message": "User not found"}

        otp = str(random.randint(100000, 999999))
        hashed_otp = await get_password_hash(otp)
        expiry = datetime.now() + timedelta(minutes=10)

        await user_model.set_reset_password_otp(email, hashed_otp, expiry)
        await email_service.send_password_reset_otp(email, otp, user['name'])

        return {"success": True, "message": "OTP sent"}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def reset_password(req_body: dict):
    try:
        email = req_body.get('email')
        otp = req_body.get('otp')
        new_password = req_body.get('newPassword')

        user = await user_model.get_user_by_email(email)
        if not user or not user.get('reset_password_otp'):
            return {"success": False, "message": "Invalid request"}

        # Verify OTP
        if not await verify_password(otp, user['reset_password_otp']):
            return {"success": False, "message": "Invalid OTP"}

        if datetime.now() > user['reset_password_otp_expiry']:
            return {"success": False, "message": "OTP Expired"}

        hashed_password = await get_password_hash(new_password)
        await user_model.update_user_password(user['id'], hashed_password)
        
        # Clear OTP (Simplified: using update_user logic or raw query)
        await db.execute('UPDATE users SET reset_password_otp = NULL, reset_password_otp_expiry = NULL WHERE id = $1', user['id'])

        return {"success": True, "message": "Password reset successful"}
    except Exception as e:
        return {"success": False, "message": str(e)}
async def mark_alerted(user_id: int, appointment_id: int):
    try:
        from app.utils.ownership import load_appointment_for_user

        _, err = await load_appointment_for_user(int(appointment_id), user_id)
        if err:
            return err
        await appointment_model.update_appointment(appointment_id, {"alerted": True})
        return {"success": True, "message": "Marked as alerted"}
    except Exception as e:
        return {"success": False, "message": str(e)}

# --- Emergency Contacts ---

async def get_emergency_contacts(user_id: int):
    try:
        contacts = await user_model.get_emergency_contacts(user_id)
        return {
            "success": True, 
            "contacts": {
                "friends": [c for c in contacts if c.get('contact_type') == 'friend'],
                "family": [c for c in contacts if c.get('contact_type') == 'family']
            }
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

async def add_emergency_contact(user_id: int, req_body: dict):
    try:
        await user_model.add_emergency_contact(user_id, req_body)
        await user_model.update_user(user_id, {"emergencyContactCompleted": True})
        user = await user_model.get_user_by_id(user_id)
        return {"success": True, "message": "Added", "userData": format_user(user)}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def update_emergency_contact(user_id: int, contact_id: int, req_body: dict):
    try:
        existing = await user_model.get_emergency_contact_by_id(contact_id)
        if not existing or existing.get("user_id") != user_id:
            return {"success": False, "message": "Contact not found"}
        await user_model.update_emergency_contact(contact_id, req_body)
        return {"success": True, "message": "Contact updated"}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def delete_emergency_contact(user_id: int, contact_id: int):
    try:
        existing = await user_model.get_emergency_contact_by_id(contact_id)
        if not existing or existing.get("user_id") != user_id:
            return {"success": False, "message": "Contact not found"}
        await user_model.delete_emergency_contact(contact_id)
        return {"success": True, "message": "Deleted"}
    except Exception as e:
        return {"success": False, "message": str(e)}

# --- Saved Profiles ---

async def get_saved_profiles(user_id: int):
    try:
        profiles = await user_model.get_saved_profiles(user_id)
        return {"success": True, "profiles": profiles}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def save_profile(user_id: int, req_body: dict):
    try:
        profile = await user_model.add_saved_profile(user_id, req_body)
        return {"success": True, "message": "Profile saved", "profile": profile}
    except Exception as e:
        return {"success": False, "message": str(e)}


async def update_saved_profile(user_id: int, profile_id: int, req_body: dict):
    try:
        profile = await user_model.update_saved_profile(user_id, profile_id, req_body)
        if not profile:
            return {"success": False, "message": "Profile not found"}
        return {"success": True, "message": "Profile updated", "profile": profile}
    except Exception as e:
        return {"success": False, "message": str(e)}


async def delete_saved_profile(user_id: int, profile_id: int):
    try:
        deleted = await user_model.delete_saved_profile(user_id, profile_id)
        if not deleted:
            return {"success": False, "message": "Profile not found"}
        return {"success": True, "message": "Profile deleted"}
    except Exception as e:
        return {"success": False, "message": str(e)}

# --- Other Functionalities ---

async def send_contact_message(req_body: dict):
    """Deliver Contact Us form to SUPPORT_EMAIL via Brevo/Gmail SMTP."""
    try:
        from app.services import email_templates as tpl
        import re

        name = str(req_body.get("name") or "").strip()
        email = str(req_body.get("email") or "").strip()
        subject = str(req_body.get("subject") or "").strip() or "Contact form"
        message = str(req_body.get("message") or "").strip()

        if not name or not email or not message:
            return {
                "success": False,
                "message": "Name, email, and message are required.",
            }
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            return {"success": False, "message": "Please enter a valid email address."}

        inbox = (settings.SUPPORT_EMAIL or "").strip()
        if not inbox:
            return {"success": False, "message": "Support inbox is not configured."}

        has_brevo = bool((settings.BREVO_API_KEY or "").strip())
        has_gmail = bool((settings.EMAIL_USER or "").strip() and (settings.EMAIL_APP_PASSWORD or "").strip())
        if not has_brevo and not has_gmail:
            log.warning("contact_form_no_email_provider")
            return {
                "success": False,
                "message": "Email is not configured. Set Brevo or Gmail SMTP on the server.",
            }

        html = tpl.contact_inquiry(
            name=name, email=email, subject=subject, message=message
        )
        result = await email_service.send_email(
            inbox,
            f"[Contact] {subject}",
            html,
            recipient_name="Support",
            critical=True,
        )
        if not result.get("success") or result.get("skipped"):
            return {
                "success": False,
                "message": result.get("message") or "Failed to send your message. Please try again.",
            }
        log.info("contact_form_sent to=%s from=%s", inbox, email)
        return {"success": True, "message": "Message sent successfully."}
    except Exception as e:
        log.exception("contact_form_failed")
        return {"success": False, "message": str(e)}

async def get_queue_status(doc_id, slot_date: str):
    try:
        queue = await queue_service.get_doctor_queue_status(doc_id, slot_date)
        return {"success": True, **queue}
    except Exception as e:
        return {"success": False, "message": str(e)}


async def get_appointment_queue_live(appointment_id: int, user_id: int):
    """Patient-safe live queue view — token numbers only, no other patient PII."""
    try:
        appointment = await appointment_model.get_appointment_by_id(appointment_id)
        if not appointment or appointment.get("user_id") != user_id:
            return {"success": False, "message": "Not found"}

        if appointment.get("cancelled") or appointment.get("is_completed"):
            return {
                "success": True,
                "tokenNumber": appointment.get("token_number"),
                "queuePosition": 0,
                "patientsAhead": 0,
                "isNextUp": False,
                "currentlyServingToken": None,
                "doctorStatus": "offline",
                "queueTokens": [],
                "inactive": True,
                "lifecycleStatus": appointment.get("lifecycle_status"),
                "receptionStatus": appointment.get("reception_status"),
            }

        doc_id = appointment["doctor_id"]
        slot_date = appointment["slot_date"]
        queue = await queue_service.get_doctor_queue_status(doc_id, slot_date)
        if not queue:
            return {"success": False, "message": "Could not load queue"}

        appt_id = int(appointment["id"])
        my_token = int(appointment.get("token_number") or 0)
        appointments = queue.get("appointments") or []

        queue_tokens = []
        my_position = 0
        patients_ahead = 0
        for item in appointments:
            token = int(item.get("tokenNumber") or 0)
            if token > 0:
                queue_tokens.append(token)
            if int(item.get("id") or item.get("_id") or 0) == appt_id:
                my_position = int(item.get("queuePosition") or 0)
                patients_ahead = max(0, my_position - 1)

        currently_serving_token = None
        current_appt_id = queue.get("currentAppointmentId")
        if current_appt_id:
            for item in appointments:
                if int(item.get("id") or item.get("_id") or 0) == int(current_appt_id):
                    currently_serving_token = int(item.get("tokenNumber") or 0)
                    break

        lifecycle = str(appointment.get("lifecycle_status") or "").upper()
        reception_status = str(appointment.get("reception_status") or "").upper()
        legacy_status = str(appointment.get("status") or "").lower()
        ready_for_doctor = (
            reception_status == "READY_FOR_DOCTOR"
            or lifecycle in ("CHECKED_IN", "IN_PROGRESS")
            or legacy_status in ("in-queue", "in-consult")
        )
        is_next_up = ready_for_doctor and (
            queue.get("currentAppointmentId") == appt_id
            or (my_position == 1 and not current_appt_id)
        )

        return {
            "success": True,
            "tokenNumber": my_token or None,
            "queuePosition": my_position,
            "patientsAhead": patients_ahead,
            "isNextUp": bool(is_next_up),
            "currentlyServingToken": currently_serving_token,
            "doctorStatus": queue.get("status", "in-clinic"),
            "queueTokens": queue_tokens,
            "inactive": False,
            "lifecycleStatus": appointment.get("lifecycle_status"),
            "receptionStatus": appointment.get("reception_status"),
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

async def get_doctor_status(doc_id):
    try:
        doctor = await doctor_model.get_doctor_by_id(doc_id)
        if not doctor:
            return {"success": False, "message": "Doctor not found"}
        return {
            "success": True,
            "status": doctor.get('status', 'offline'),
            "available": doctor.get('available'),
            "currentAppointmentId": doctor.get('current_appointment_id')
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

def _format_staff_appointment_view(appointment: dict, queue_status: dict | None = None) -> dict:
    user_data = appointment.get('user_data')
    if isinstance(user_data, str):
        user_data = json.loads(user_data) if user_data else {}
    doc_data = appointment.get('doctor_data')
    if isinstance(doc_data, str):
        doc_data = json.loads(doc_data) if doc_data else {}

    token_number = int(appointment.get('token_number') or 0)
    appt_id = int(appointment['id'])

    patient_name = appointment.get('actual_patient_name') or (user_data or {}).get('name') or 'Patient'
    if appointment.get('actual_patient_is_self') and (user_data or {}).get('name'):
        patient_name = user_data['name']

    status = appointment.get('status') or 'pending'
    if appointment.get('cancelled'):
        status = 'cancelled'
    elif appointment.get('is_completed'):
        status = 'completed'

    view = {
        "appointmentId": appt_id,
        "bookingId": appointment.get('booking_id'),
        "tokenNumber": token_number,
        "queuePosition": appointment.get('queue_position'),
        "estimatedWaitTime": appointment.get('estimated_wait_time'),
        "patientName": patient_name,
        "patientPhone": (user_data or {}).get('phone'),
        "doctorName": (doc_data or {}).get('name'),
        "specialization": (doc_data or {}).get('speciality') or (doc_data or {}).get('specialization'),
        "hospitalName": (doc_data or {}).get('hospital_name') or (doc_data or {}).get('hospitalName'),
        "slotDate": appointment.get('slot_date'),
        "slotTime": appointment.get('slot_time'),
        "amount": float(appointment.get('amount') or 0),
        "paymentMethod": appointment.get('payment_method'),
        "visitType": appointment.get('mode'),
        "status": status,
        "cancelled": appointment.get('cancelled'),
        "isCompleted": appointment.get('is_completed'),
        "queueLength": (queue_status or {}).get('queueLength'),
        "isNextUp": (queue_status or {}).get('currentAppointmentId') == appt_id,
    }
    try:
        from app.services import appointment_summary_service
        completed = bool(appointment.get("is_completed")) or (
            str(appointment.get("lifecycle_status") or "").upper() == "COMPLETED"
        )
        view["summaryQrUrl"] = (
            appointment_summary_service.summary_qr_url_for_booking(appointment.get("booking_id"))
            if completed
            else None
        )
    except Exception:
        view["summaryQrUrl"] = None
    try:
        from app.services import appointment_lifecycle_service
        view.update(appointment_lifecycle_service.lifecycle_payload(appointment))
    except Exception:
        pass
    return view


async def verify_appointment(appointment_id: int, user_id: int = None):
    try:
        appointment = await appointment_model.get_appointment_by_id(appointment_id)
        if not appointment or (user_id and appointment['user_id'] != user_id):
            return {"success": False, "message": "Not found"}

        doc_id = appointment['doctor_id']
        queue_status = await queue_service.get_doctor_queue_status(doc_id, appointment['slot_date'])

        return {
            "success": True,
            "appointment": {
                **appointment,
                "_id": appointment['id'],
                "queuePosition": queue_status.get('queueLength', 0),
                "estimatedWaitTime": appointment['estimated_wait_time'],
                "isNextUp": queue_status.get('currentAppointmentId') == appointment['id'],
                "bookingId": appointment.get('booking_id'),
                "tokenNumber": appointment.get('token_number'),
            }
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


async def get_appointment_by_booking_id(booking_id: str, sig: str | None = None):
    """BK lookup — requires valid HMAC sig (unauthenticated public route)."""
    try:
        from fastapi import HTTPException
        from app.utils.booking_id import is_valid_booking_id, normalize_booking_id
        from app.utils.appointment_summary_qr import verify_booking_lookup_sig

        code = normalize_booking_id(booking_id)
        if not is_valid_booking_id(code):
            return {"success": False, "message": "Invalid booking ID format"}
        if not verify_booking_lookup_sig(code, sig):
            raise HTTPException(
                status_code=401,
                detail="Missing or invalid signature. Pass ?sig= from sign_booking_lookup.",
            )

        appointment = await appointment_model.get_appointment_by_booking_id(code)
        if not appointment:
            return {"success": False, "message": "Appointment not found"}

        doc_data = appointment.get("doctor_data")
        if isinstance(doc_data, str):
            try:
                doc_data = json.loads(doc_data) if doc_data else {}
            except Exception:
                doc_data = {}
        if not isinstance(doc_data, dict):
            doc_data = {}
        user_data = appointment.get("user_data")
        if isinstance(user_data, str):
            try:
                user_data = json.loads(user_data) if user_data else {}
            except Exception:
                user_data = {}
        if not isinstance(user_data, dict):
            user_data = {}

        return {
            "success": True,
            "appointment": {
                "bookingId": appointment.get("booking_id"),
                "slotDate": str(appointment.get("slot_date") or ""),
                "slotTime": appointment.get("slot_time"),
                "lifecycleStatus": appointment.get("lifecycle_status"),
                "tokenNumber": appointment.get("token_number"),
                "cancelled": bool(appointment.get("cancelled")),
                "isCompleted": bool(appointment.get("is_completed")),
                "patientName": appointment.get("actual_patient_name") or user_data.get("name"),
                "doctorName": doc_data.get("name"),
                "hospitalId": appointment.get("hospital_id"),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Booking ID lookup: {e}")
        return {"success": False, "message": str(e)}

# --- Placeholder Payments ---

async def init_payu_payment(user_id: int, req_body: dict):
    # Replicating hashing logic from JS
    try:
        appointment_id = req_body.get('appointmentId')
        amount = req_body.get('amount')
        firstname = req_body.get('firstname')
        email = req_body.get('email')
        phone = req_body.get('phone')
        productinfo = req_body.get('productinfo')

        merchant_key = (settings.PAYU_MERCHANT_KEY or "").strip()
        merchant_salt = (settings.PAYU_MERCHANT_SALT or "").strip()
        payu_base_url = (settings.PAYU_BASE_URL or "").strip()
        if not merchant_key or not merchant_salt:
            return {
                "success": False,
                "message": "PayU is not configured. Set PAYU_MERCHANT_KEY and PAYU_MERCHANT_SALT.",
            }
        if not payu_base_url:
            return {
                "success": False,
                "message": "PayU is not configured. Set PAYU_BASE_URL.",
            }

        txnid = f"TXN_{appointment_id}_{int(time.time() * 1000)}"
        udf1 = str(appointment_id)
        udf2 = str(user_id)

        # Hash Formula: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
        hash_string = f"{merchant_key}|{txnid}|{amount}|{productinfo}|{firstname}|{email}|{udf1}|{udf2}|||||||||{merchant_salt}"
        import hashlib
        hash_val = hashlib.sha512(hash_string.encode('utf-8')).hexdigest()

        return {
            "success": True,
            "paymentData": {
                "key": merchant_key,
                "txnid": txnid,
                "amount": amount,
                "productinfo": productinfo,
                "firstname": firstname,
                "email": email,
                "phone": phone,
                "udf1": udf1,
                "udf2": udf2,
                "hash": hash_val,
                "payuUrl": payu_base_url
            }
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

async def get_merchant_upi():
    upi = (getattr(settings, "MERCHANT_UPI_ID", None) or "").strip()
    if not upi:
        return {"success": False, "message": "Merchant UPI is not configured. Set MERCHANT_UPI_ID."}
    return {"success": True, "merchantUPI": upi}


async def register_fcm_token(user_id: int, body: dict):
    from app.utils.ownership import reject_client_user_override

    override_err = reject_client_user_override(body, user_id)
    if override_err:
        return override_err
    token = (body.get("token") or body.get("fcm_token") or "").strip()
    if not token:
        return {"success": False, "message": "FCM token is required"}
    platform = (body.get("platform") or "android").strip().lower()
    from app.models import fcm_token_model

    await fcm_token_model.upsert_token(user_id, token, platform)
    return {"success": True, "message": "FCM token saved"}


async def remove_fcm_token(user_id: int, body: dict):
    from app.utils.ownership import reject_client_user_override

    override_err = reject_client_user_override(body, user_id)
    if override_err:
        return override_err
    token = (body.get("token") or body.get("fcm_token") or "").strip()
    if not token:
        return {"success": False, "message": "FCM token is required"}
    from app.models import fcm_token_model

    await fcm_token_model.delete_token(user_id, token)
    return {"success": True, "message": "FCM token removed"}


def _format_notification(row: dict) -> dict:
    created = row.get("created_at")
    return {
        "id": str(row.get("id")),
        "title": row.get("title") or "",
        "message": row.get("body") or "",
        "type": row.get("type") or "system",
        "appointmentId": str(row["appointment_id"]) if row.get("appointment_id") is not None else None,
        "read": bool(row.get("is_read")),
        "createdAt": created.isoformat() if created else None,
    }


async def list_notifications(user_id: int, limit: int = 50, offset: int = 0):
    from app.models import notification_model

    rows = await notification_model.list_for_user(user_id, limit=limit, offset=offset)
    unread = await notification_model.unread_count(user_id)
    return {
        "success": True,
        "notifications": [_format_notification(r) for r in rows],
        "unreadCount": unread,
    }


async def mark_notification_read(user_id: int, notification_id):
    from app.models import notification_model

    try:
        nid = int(notification_id)
    except (TypeError, ValueError):
        return {"success": False, "message": "Valid notification id is required"}
    await notification_model.mark_read(user_id, nid)
    return {"success": True}


async def mark_all_notifications_read(user_id: int):
    from app.models import notification_model

    await notification_model.mark_all_read(user_id)
    return {"success": True}
