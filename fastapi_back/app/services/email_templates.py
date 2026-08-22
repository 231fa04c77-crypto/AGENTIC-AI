"""MEDCLUES corporate email HTML templates — white card, #0F4C81, no gradients."""
from datetime import datetime
from html import escape
from typing import List, Optional, Tuple

from app.config.config import settings

BRAND_BLUE = "#0F4C81"
BRAND_GREEN = "#16A34A"
BRAND_AMBER = "#D97706"
BRAND_RED = "#DC2626"
BG_PAGE = "#F3F4F6"
BG_CARD = "#FFFFFF"
BORDER = "#E5E7EB"
TEXT_PRIMARY = "#111827"
TEXT_MUTED = "#6B7280"
TAGLINE = "Your Health, Our Priority"


def support_email() -> str:
    return (settings.SUPPORT_EMAIL or "support@medclues.com").strip() or "support@medclues.com"


def support_phone() -> str:
    return (getattr(settings, "SUPPORT_PHONE", None) or "1800-123-4567").strip() or "1800-123-4567"


# Back-compat aliases (resolved at import; prefer support_email() / support_phone())
SUPPORT_EMAIL = support_email()
SUPPORT_PHONE = support_phone()


def _e(value) -> str:
    return escape(str(value or ""), quote=True)


def _logo_url() -> str:
    return (settings.EMAIL_LOGO_URL or "").strip()


def _logo_img(width: int = 140, margin_bottom: int = 10) -> str:
    url = _logo_url()
    if not url:
        return (
            f'<p style="margin:0 0 {margin_bottom}px;font-size:22px;font-weight:700;'
            f'color:{BRAND_BLUE};letter-spacing:0.5px;">MEDCLUES</p>'
        )
    return f"""
    <img src="{_e(url)}" alt="MEDCLUES" width="{width}" height="auto"
         style="display:block;margin:0 auto {margin_bottom}px;border:0;outline:none;max-width:{width}px;height:auto;" />"""


def _footer() -> str:
    year = datetime.now().year
    logo_footer = _logo_img(width=72, margin_bottom=8) if _logo_url() else ""
    return f"""
    <tr>
      <td style="padding:24px 32px;background-color:{BG_PAGE};border-top:1px solid {BORDER};text-align:center;">
        {logo_footer}
        <p style="margin:0 0 8px;font-size:12px;color:{TEXT_MUTED};line-height:1.5;">{_e(TAGLINE)}</p>
        <p style="margin:0 0 8px;font-size:12px;color:{TEXT_MUTED};line-height:1.6;">
          Secure &bull; HIPAA Inspired &bull; Patient First &bull; Trusted Healthcare Platform
        </p>
        <p style="margin:0 0 4px;font-size:12px;color:{TEXT_MUTED};">
          &#128274; Your health data is safe and secure with us.
        </p>
        <p style="margin:8px 0 0;font-size:12px;color:{TEXT_MUTED};">
          {_e(support_email())} &nbsp;|&nbsp; {_e(support_phone())}
        </p>
        <p style="margin:12px 0 0;font-size:11px;color:#9CA3AF;">
          This is an automated email. Please do not reply.<br>
          &copy; {year} MEDCLUES. All rights reserved.
        </p>
      </td>
    </tr>"""


def _header() -> str:
    return f"""
    <tr>
      <td style="padding:28px 32px 20px;text-align:center;border-bottom:1px solid {BORDER};">
        {_logo_img(width=160, margin_bottom=12)}
        <p style="margin:0;font-size:13px;color:{TEXT_MUTED};letter-spacing:0.2px;">{_e(TAGLINE)}</p>
      </td>
    </tr>"""


def _icon_circle(symbol: str, color: str, bg: str) -> str:
    return f"""
    <div style="width:56px;height:56px;margin:0 auto 16px;border-radius:50%;background-color:{bg};
                color:{color};font-size:26px;line-height:56px;text-align:center;">
      {symbol}
    </div>"""


def _heading(text: str, color: str = BRAND_BLUE) -> str:
    return f"""
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:{color};text-align:center;">
      {_e(text)}
    </h1>"""


def _greeting(name: str) -> str:
    return f'<p style="margin:0 0 16px;font-size:15px;color:{TEXT_PRIMARY};">Hi {_e(name)},</p>'


def _body_text(text: str) -> str:
    return f'<p style="margin:0 0 16px;font-size:14px;color:{TEXT_PRIMARY};line-height:1.6;">{text}</p>'


def _data_table(rows: List[Tuple[str, str]], tint: str = "#EFF6FF") -> str:
  """rows: list of (label, value)"""
  rows_html = ""
  for label, value in rows:
      rows_html += f"""
      <tr>
        <td style="padding:10px 14px;font-size:13px;color:{TEXT_MUTED};width:38%;vertical-align:top;border-bottom:1px solid {BORDER};">
          {_e(label)}
        </td>
        <td style="padding:10px 14px;font-size:13px;color:{TEXT_PRIMARY};font-weight:600;vertical-align:top;border-bottom:1px solid {BORDER};">
          {_e(value)}
        </td>
      </tr>"""
  return f"""
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin:20px 0;border:1px solid {BORDER};border-radius:8px;overflow:hidden;background-color:{tint};">
    {rows_html}
  </table>"""


def _cta_button(label: str, url: str, color: str = BRAND_BLUE) -> str:
    safe_url = _e(url or "#")
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 4px;">
      <tr>
        <td align="center">
          <a href="{safe_url}" target="_blank"
             style="display:inline-block;padding:12px 28px;background-color:{color};color:#FFFFFF;
                    font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
            {_e(label)}
          </a>
        </td>
      </tr>
    </table>"""


def _otp_boxes(otp: str) -> str:
    digits = [c for c in str(otp) if c.isdigit()]
    boxes = ""
    for d in digits:
        boxes += f"""
        <td style="padding:0 4px;">
          <div style="width:44px;height:52px;line-height:52px;text-align:center;font-size:24px;font-weight:700;
                      color:{BRAND_BLUE};background:#FFFFFF;border:2px solid {BRAND_BLUE};border-radius:8px;">
            {_e(d)}
          </div>
        </td>"""
    return f"""
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px auto;">
      <tr>{boxes}</tr>
    </table>"""


def _note_box(text: str, tint: str = "#FEF3C7", border: str = BRAND_AMBER) -> str:
    return f"""
    <div style="margin:16px 0;padding:14px 16px;background-color:{tint};border-left:4px solid {border};
                border-radius:6px;font-size:13px;color:{TEXT_PRIMARY};line-height:1.5;">
      {text}
    </div>"""


def wrap_email(content: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:{BG_PAGE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{BG_PAGE};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:600px;background-color:{BG_CARD};border:1px solid {BORDER};
                      border-radius:12px;box-shadow:0 4px 24px rgba(15,76,129,0.08);overflow:hidden;">
          {_header()}
          <tr>
            <td style="padding:28px 32px 8px;">
              {content}
            </td>
          </tr>
          {_footer()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


# --- Scenario templates ---

def registration_success(name: str, email: str, login_url: str) -> str:
    reg_date = datetime.now().strftime("%d %B %Y, %I:%M %p")
    content = f"""
    {_icon_circle("&#10003;", BRAND_BLUE, "#EFF6FF")}
    {_heading("Welcome to MEDCLUES!")}
    {_greeting(name)}
    {_body_text("Your account has been created successfully. You can now book appointments, access health records, and manage your care from the MEDCLUES app.")}
    {_data_table([
        ("Full Name", name),
        ("Email Address", email),
        ("Registration Date", reg_date),
    ], "#EFF6FF")}
    {_cta_button("Login to App", login_url, BRAND_BLUE)}
    """
    return wrap_email(content)


def otp_verification(otp: str, purpose: str = "account verification") -> str:
    content = f"""
    {_icon_circle("&#128274;", BRAND_BLUE, "#EFF6FF")}
    {_heading("Verify Your Account")}
    {_body_text(f"Use the one-time password below to complete your {purpose}.")}
    {_otp_boxes(otp)}
    <p style="margin:0;text-align:center;font-size:13px;color:{TEXT_MUTED};">
      &#9201; Valid for <strong>10 minutes</strong>
    </p>
    {_note_box(
        "<strong>Security tip:</strong> Never share this code with anyone. MEDCLUES will never ask for your OTP by phone or email.",
        "#EFF6FF", BRAND_BLUE
    )}
    """
    return wrap_email(content)


def password_reset(otp: str, name: str = "there") -> str:
    content = f"""
    {_icon_circle("&#128273;", BRAND_BLUE, "#EFF6FF")}
    {_heading("Reset Your Password")}
    {_greeting(name)}
    {_body_text("We received a request to reset the password for your MEDCLUES account. Enter the verification code below to set a new password.")}
    {_otp_boxes(otp)}
    <p style="margin:0;text-align:center;font-size:13px;color:{TEXT_MUTED};">
      &#9201; This code is valid for <strong>10 minutes</strong>
    </p>
    {_note_box(
        "<strong>Didn't request this?</strong> You can safely ignore this email — your password will stay the same. "
        "For your security, never share this code with anyone.",
        "#FFFBEB", BRAND_AMBER
    )}
    """
    return wrap_email(content)


def appointment_confirmed(details: dict, view_url: str) -> str:
    patient = details.get("patientName", "Patient")
    hospital_name = details.get("hospitalName", "MEDCLUES Partner Hospital")
    hospital_location = details.get("hospitalLocation") or details.get("hospitalAddress") or ""
    maps_url = (details.get("mapsLink") or "").strip()

    rows = [
        ("Doctor", details.get("doctorName", "")),
        ("Specialty", details.get("speciality", "")),
        ("Date & Time", f"{details.get('date', '')}, {details.get('time', '')}"),
        ("Token Number", f"#{details.get('tokenNumber', 'N/A')}"),
        ("Hospital", hospital_name),
    ]
    if hospital_location:
        rows.append(("Location", hospital_location))
    rows.extend([
        ("Booking ID", details.get("bookingId") or ""),
        ("Consultation Fee", f"Rs. {details.get('fee', '')}"),
    ])

    maps_cta = _cta_button("View in Maps", maps_url, BRAND_BLUE) if maps_url else ""

    content = f"""
    {_icon_circle("&#128197;", BRAND_GREEN, "#ECFDF5")}
    {_heading("Appointment Confirmed!", BRAND_GREEN)}
    {_greeting(patient)}
    {_body_text("Your appointment has been booked successfully. Please find the details below.")}
    {_data_table([(l, v) for l, v in rows if v], "#ECFDF5")}
    {_cta_button("Open in MEDCLUES App", view_url, BRAND_GREEN)}
    {maps_cta}
    <p style="margin:8px 0 0;font-size:12px;color:{TEXT_MUTED};text-align:center;line-height:1.5;">
      On your phone, <strong>Open in MEDCLUES App</strong> opens this appointment.
      <strong>View in Maps</strong> lets you choose Google Maps, Uber, Rapido, or similar.
    </p>
    {_note_box("Please arrive 15 minutes early and carry a valid ID proof.", "#ECFDF5", BRAND_GREEN)}
    """
    return wrap_email(content)


def appointment_rescheduled(
    name: str,
    doctor_name: str,
    previous_date: str,
    previous_time: str,
    new_date: str,
    new_time: str,
    booking_id: str,
    view_url: str,
) -> str:
    content = f"""
    {_icon_circle("&#9200;", BRAND_AMBER, "#FFFBEB")}
    {_heading("Appointment Rescheduled", BRAND_AMBER)}
    {_greeting(name)}
    {_body_text(f"Your appointment with <strong>{_e(doctor_name)}</strong> has been rescheduled. Please note the updated details below.")}
    {_data_table([
        ("Doctor", doctor_name),
        ("Previous Date", f"{previous_date}, {previous_time}"),
        ("New Date & Time", f"{new_date}, {new_time}"),
        ("Booking ID", booking_id),
    ], "#FFFBEB")}
    {_cta_button("View Updated Appointment", view_url, BRAND_AMBER)}
    """
    return wrap_email(content)


def appointment_cancelled(
    name: str,
    details: dict,
    reason: str,
    view_url: str,
    refund_note: Optional[str] = None,
) -> str:
    refund = refund_note or "If applicable, your refund will be processed within 5–7 business days."
    rows = [
        ("Doctor", details.get("doctorName", "")),
        ("Date & Time", f"{details.get('date', '')}, {details.get('time', '')}"),
        ("Token Number", f"#{details.get('tokenNumber', 'N/A')}"),
        ("Appointment ID", details.get("publicId", details.get("bookingId", ""))),
        ("Receipt / QR Code", details.get("bookingId", "")),
        ("Reason", reason),
    ]
    content = f"""
    {_icon_circle("&#10005;", BRAND_RED, "#FEF2F2")}
    {_heading("Appointment Cancelled", BRAND_RED)}
    {_greeting(name)}
    {_body_text("Your appointment has been cancelled as requested. Details are shown below.")}
    {_data_table([(l, v) for l, v in rows if v], "#FEF2F2")}
    {_note_box(f"&#8505; {refund}", "#FEF2F2", BRAND_RED)}
    {_cta_button("Book New Appointment", view_url, BRAND_RED)}
    """
    return wrap_email(content)


def medical_report_available(
    name: str,
    report_name: str,
    upload_date: str,
    uploaded_by: str,
    report_type: str,
    view_url: str,
) -> str:
    content = f"""
    {_icon_circle("&#128196;", BRAND_BLUE, "#EFF6FF")}
    {_heading("New Medical Report Available")}
    {_greeting(name)}
    {_body_text("A new medical report has been added to your MEDCLUES health records.")}
    {_data_table([
        ("Report Name", report_name),
        ("Upload Date", upload_date),
        ("Uploaded By", uploaded_by),
        ("Report Type", report_type),
    ], "#EFF6FF")}
    {_cta_button("View in MEDCLUES App", view_url, BRAND_BLUE)}
    """
    return wrap_email(content)


def login_security_alert(name: str, login_time: str) -> str:
    content = f"""
    {_icon_circle("&#128274;", BRAND_BLUE, "#EFF6FF")}
    {_heading("Security Alert: New Login")}
    {_greeting(name)}
    {_body_text(f"A new login to your MEDCLUES account was detected on <strong>{_e(login_time)}</strong>.")}
    {_note_box(
        "If this was not you, please reset your password immediately or contact support.",
        "#FFFBEB", BRAND_AMBER
    )}
    """
    return wrap_email(content)


def doctor_portal_credentials(name: str, email: str, password: str, hospital_name: str, login_url: str) -> str:
    content = f"""
    {_icon_circle("&#128104;&#8205;&#9877;&#65039;", BRAND_BLUE, "#EFF6FF")}
    {_heading("Doctor Portal Access")}
    {_greeting(f"Dr. {name}")}
    {_body_text(f"Your professional account at <strong>{_e(hospital_name)}</strong> has been created. Use the credentials below to sign in.")}
    {_data_table([
        ("Email", email),
        ("Temporary Password", password),
        ("Hospital", hospital_name),
    ], "#EFF6FF")}
    {_cta_button("Login to Doctor Panel", login_url, BRAND_BLUE)}
    {_note_box(
        "<strong>Security note:</strong> Change your password after first login. Do not share these credentials.",
        "#FFFBEB", BRAND_AMBER
    )}
    """
    return wrap_email(content)


def job_interview(name: str, position: str) -> str:
    content = f"""
    {_icon_circle("&#127881;", BRAND_BLUE, "#EFF6FF")}
    {_heading("Interview Invitation")}
    {_greeting(name)}
    {_body_text(f"Thank you for applying for the <strong>{_e(position)}</strong> role at MEDCLUES. We would like to schedule an interview with you.")}
    {_note_box("Our HR team will contact you shortly to confirm a time slot.", "#EFF6FF", BRAND_BLUE)}
    """
    return wrap_email(content)


def job_rejection(name: str, position: str) -> str:
    content = f"""
    {_icon_circle("&#128196;", BRAND_BLUE, "#EFF6FF")}
    {_heading("Application Update")}
    {_greeting(name)}
    {_body_text(f"Thank you for your interest in the <strong>{_e(position)}</strong> role at MEDCLUES. After careful review, we have decided to move forward with other candidates at this time.")}
    {_body_text("We will keep your profile on file for future opportunities. We wish you the best in your career journey.")}
    """
    return wrap_email(content)


def super_appointment_received(name: str, details: dict) -> str:
    content = f"""
    {_icon_circle("&#128221;", BRAND_BLUE, "#EFF6FF")}
    {_heading("Support Request Received")}
    {_greeting(name)}
    {_body_text(f"We have received your request for <strong>{_e(details.get('service_type', 'support'))}</strong>. Our team will contact you shortly.")}
    {_data_table([
        ("Service", details.get("service_type", "")),
        ("Date", details.get("appointment_date", "")),
        ("Preferred Time", details.get("appointment_time", "")),
    ], "#EFF6FF")}
    """
    return wrap_email(content)


def super_appointment_status(name: str, service_type: str, status: str) -> str:
    status_lower = (status or "").lower()
    if status_lower == "confirmed":
        color, tint = BRAND_GREEN, "#ECFDF5"
    elif status_lower == "cancelled":
        color, tint = BRAND_RED, "#FEF2F2"
    else:
        color, tint = BRAND_BLUE, "#EFF6FF"
    content = f"""
    {_icon_circle("&#128260;", color, tint)}
    {_heading("Request Status Update", color)}
    {_greeting(name)}
    {_body_text(f"The status of your <strong>{_e(service_type)}</strong> request has been updated:")}
    <p style="margin:20px 0;text-align:center;">
      <span style="display:inline-block;padding:10px 24px;background-color:{color};color:#FFFFFF;
                   font-size:16px;font-weight:700;border-radius:24px;text-transform:uppercase;letter-spacing:1px;">
        {_e(status)}
      </span>
    </p>
    {_body_text(f"Questions? Contact us at {_e(support_email())}.")}
    """
    return wrap_email(content)


def contact_inquiry(
    *,
    name: str,
    email: str,
    subject: str,
    message: str,
) -> str:
    """HTML for inbound Contact Us form → support inbox."""
    content = f"""
    {_icon_circle("&#9993;", BRAND_BLUE, "#EFF6FF")}
    {_heading("New Contact Message")}
    {_body_text("A visitor sent a message from the MEDCLUES Contact Us form.")}
    {_data_table([
        ("Name", name),
        ("Reply-to", email),
        ("Subject", subject),
    ])}
    {_body_text("<strong>Message</strong>")}
    {_note_box(_e(message).replace(chr(10), "<br>"), tint="#F9FAFB", border=BRAND_BLUE)}
    {_body_text(f"Reply directly to <strong>{_e(email)}</strong>.")}
    """
    return wrap_email(content)
