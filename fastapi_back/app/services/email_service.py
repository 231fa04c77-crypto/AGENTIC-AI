import os
import aiosmtplib
import httpx
from email.message import EmailMessage
from app.config.config import settings
from datetime import datetime
from app.services import email_templates as tpl

APP_NAME = "MedClues"


def _app_login_url(path: str = "") -> str:
    base = (settings.FRONTEND_URL or "https://medclues.onrender.com").rstrip("/")
    return f"{base}{path}" if path else base


async def send_email(
    to: str,
    subject: str,
    html_content: str,
    recipient_name: str = "User",
    sender_name: str = None,
    *,
    critical: bool = False,
):
    """Send email. Non-critical mail is skipped when email notifications are disabled."""
    if not critical:
        try:
            from app.models import platform_settings_model
            if not await platform_settings_model.email_notifications_enabled():
                print(f"[EMAIL] Skipped (notifications off): {subject} -> {to}")
                return {"success": True, "message": "Email notifications disabled", "skipped": True}
        except Exception as gate_err:
            print(f"[EMAIL] Notification gate check failed (sending anyway): {gate_err}")

    try:
        api_key = settings.BREVO_API_KEY
        sender_email = settings.BREVO_SENDER_EMAIL or os.getenv("EMAIL_USER")
        app_name = settings.BREVO_APP_NAME or APP_NAME

        if not api_key:
            print("[ERROR] Brevo API Key missing. Skipping HTTP attempt.")
            raise Exception("API Key missing")

        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": api_key,
        }

        payload = {
            "sender": {"email": sender_email, "name": sender_name or app_name},
            "to": [{"email": to, "name": recipient_name}],
            "subject": subject,
            "htmlContent": html_content,
        }

        print(f"[EMAIL] Sending via Brevo HTTP API to {to}...")
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=10.0)

        if response.status_code == 201:
            print(f"[SUCCESS] Email sent via Brevo HTTP successfully to {to}")
            return {"success": True, "message": "Email sent"}
        print(f"[WARNING] Brevo API Error ({response.status_code}): {response.text}")
        raise Exception(f"Brevo API error: {response.status_code}")

    except Exception as e:
        print(f"[WARNING] Brevo HTTP failed: {e}. Trying Gmail SMTP as fallback...")
        try:
            gmail_user = os.getenv("EMAIL_USER")
            gmail_pass = os.getenv("EMAIL_APP_PASSWORD")

            if not gmail_user or not gmail_pass:
                print("[ERROR] Gmail fallback credentials missing.")
                return {"success": False, "message": "No configured email routes working"}

            msg = EmailMessage()
            msg["From"] = f"{sender_name or APP_NAME} <{gmail_user}>"
            msg["To"] = f"{recipient_name} <{to}>"
            msg["Subject"] = subject
            msg.set_content("HTML content received", subtype="html")
            msg.add_alternative(html_content, subtype="html")

            await aiosmtplib.send(
                msg,
                hostname="smtp.gmail.com",
                port=587,
                start_tls=True,
                username=gmail_user,
                password=gmail_pass,
            )
            print(f"[SUCCESS] Email sent via Gmail Fallback successfully to {to}")
            return {"success": True, "message": "Email sent via fallback"}
        except Exception as fallback_e:
            print(f"[ERROR] Both email routes failed. Primary: {e}, Fallback: {fallback_e}")
            return {"success": False, "message": str(fallback_e)}


async def send_password_reset_otp(email: str, otp: str, user_name: str):
    subject = "Reset your password — MEDCLUES"
    html_content = tpl.password_reset(otp, user_name or "there")
    return await send_email(email, subject, html_content, user_name, critical=True)


async def send_appointment_confirmation(email: str, details: dict):
    patient_name = details.get("patientName", "Patient")
    hospital_name = details.get("hospitalName", "MEDCLUES Partner Hospital")
    subject = f"Appointment Confirmed — {hospital_name}"
    from app.utils.mobile_links import appointment_email_link

    appointment_id = details.get("appointmentId")
    view_url = details.get("viewUrl")
    if not view_url and appointment_id:
        view_url = appointment_email_link(appointment_id)
    if not view_url:
        view_url = _app_login_url("/my-appointments")
    html_content = tpl.appointment_confirmed(details, view_url)
    return await send_email(email, subject, html_content, patient_name)


async def send_appointment_rescheduled(
    email: str,
    name: str,
    doctor_name: str,
    previous_date: str,
    previous_time: str,
    new_date: str,
    new_time: str,
    booking_id: str,
):
    subject = "Appointment Rescheduled — MEDCLUES"
    view_url = _app_login_url("/my-appointments")
    html_content = tpl.appointment_rescheduled(
        name, doctor_name, previous_date, previous_time, new_date, new_time, booking_id, view_url
    )
    return await send_email(email, subject, html_content, name)


async def send_appointment_cancelled(email: str, name: str, details: dict, reason: str = "Cancelled by user"):
    subject = "Appointment Cancelled — MEDCLUES"
    view_url = _app_login_url("/book-appointment")
    html_content = tpl.appointment_cancelled(name, details, reason, view_url)
    return await send_email(email, subject, html_content, name)


async def send_medical_report_available(
    email: str,
    name: str,
    report_name: str,
    upload_date: str,
    uploaded_by: str,
    report_type: str,
):
    subject = "New Medical Report Available — MEDCLUES"
    view_url = _app_login_url("/health-records")
    html_content = tpl.medical_report_available(
        name, report_name, upload_date, uploaded_by, report_type, view_url
    )
    return await send_email(email, subject, html_content, name)


async def send_otp_email(email: str, otp: str):
    subject = "Your OTP for Verification — MEDCLUES"
    html_content = tpl.otp_verification(otp)
    return await send_email(email, subject, html_content, critical=True)


async def send_email_verification_otp(email: str, otp: str, user_name: str = "User"):
    subject = "Verify your email — MEDCLUES"
    html_content = tpl.otp_verification(otp, purpose="email verification")
    return await send_email(email, subject, html_content, user_name, critical=True)


async def send_welcome_email(email: str, name: str):
    subject = "Welcome to MEDCLUES — Registration Successful"
    html_content = tpl.registration_success(name, email, _app_login_url("/login"))
    return await send_email(email, subject, html_content, name)


async def send_login_alert(email: str, name: str):
    """Disabled — login security emails are not sent."""
    return {"success": True, "message": "Login alert emails disabled"}


async def send_appointment_rejection(email: str, name: str, details: dict):
    subject = "Appointment Cancelled — MEDCLUES"
    reason = details.get("reason", "Scheduling conflict")
    view_url = _app_login_url("/book-appointment")
    html_content = tpl.appointment_cancelled(name, details, reason, view_url)
    return await send_email(email, subject, html_content, name)


async def send_job_email(email, name, position, email_type):
    if email_type == "interview":
        subject = f"Interview Invitation — MEDCLUES ({position})"
        html_content = tpl.job_interview(name, position)
    else:
        subject = f"Application Update — MEDCLUES ({position})"
        html_content = tpl.job_rejection(name, position)
    return await send_email(email, subject, html_content, name)


async def send_doctor_credentials(email: str, name: str, password: str, hospital_name: str):
    subject = f"Doctor Portal Access — {hospital_name}"
    html_content = tpl.doctor_portal_credentials(
        name, email, password, hospital_name, _app_login_url("/login")
    )
    return await send_email(email, subject, html_content, name, critical=True)


async def send_super_appointment_notification(email: str, name: str, details: dict):
    subject = f"Support Request Received — {details.get('service_type', 'MEDCLUES')}"
    html_content = tpl.super_appointment_received(name, details)
    return await send_email(email, subject, html_content, name)


async def send_super_appointment_status_update(email: str, name: str, service_type: str, status: str):
    subject = f"Request Update: {service_type} — {status.capitalize()}"
    html_content = tpl.super_appointment_status(name, service_type, status)
    return await send_email(email, subject, html_content, name)


async def verify_brevo_connection():
    """Health check for Brevo API key (used by otp_routes)."""
    api_key = settings.BREVO_API_KEY
    if not api_key:
        return {"success": False, "message": "BREVO_API_KEY not configured"}
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.brevo.com/v3/account",
                headers={"api-key": api_key},
                timeout=10.0,
            )
        if response.status_code == 200:
            return {"success": True, "message": "Brevo connection OK"}
        return {"success": False, "message": f"Brevo error: {response.status_code}"}
    except Exception as e:
        return {"success": False, "message": str(e)}
