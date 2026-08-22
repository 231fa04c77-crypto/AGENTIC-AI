import os
import re
from app.services import email_service
from app.utils import otp_storage

def is_valid_email(email: str) -> bool:
    """Validate email address using regex"""
    return re.match(r"[^@]+@[^@]+\.[^@]+", email) is not None

async def send_otp(email: str):
    try:
        # Validate email
        if not email or not is_valid_email(email):
            return {
                "success": False,
                "message": "Please provide a valid email address"
            }

        # Check if API key is configured (handled in email_service)
        
        # Check if email already has active OTP
        if otp_storage.has_active_otp(email):
            remaining = otp_storage.get_otp_remaining_time(email)
            minutes = remaining // 60
            seconds = remaining % 60
            return {
                "success": False,
                "message": f"OTP already sent. Please wait {minutes}:{seconds:02d} before requesting a new one"
            }

        # Generate OTP
        otp = otp_storage.generate_otp()

        # Store OTP
        try:
            otp_storage.store_otp(email, otp)
        except Exception as store_err:
            return {
                "success": False,
                "message": str(store_err) or "Failed to generate OTP"
            }

        # Send OTP via email using Brevo
        email_result = await email_service.send_otp_email(email, otp)

        if email_result.get('success'):
            print(f"[SUCCESS] OTP sent successfully to {email}")
            return {
                "success": True,
                "message": "OTP sent successfully to your email. Please check your inbox."
            }

        from app.config.config import settings
        if settings.DEBUG:
            print(f"[DEV] OTP for {email}: {otp}")
            return {
                "success": True,
                "message": "OTP generated (email failed — use dev_otp in development)",
                "dev_otp": otp,
                "email_error": email_result.get('message'),
            }

        otp_storage.remove_otp(email)
        return {
            "success": False,
            "message": email_result.get('message')
            or "Failed to send OTP. Whitelist your IP in Brevo or set EMAIL_USER + EMAIL_APP_PASSWORD.",
        }

    except Exception as e:
        print(f"[ERROR] Error in send_otp: {e}")
        return {
            "success": False,
            "message": str(e) or "Failed to send OTP. Please try again later."
        }

async def verify_otp_code(email: str, otp: str):
    try:
        # Validate inputs
        if not email or not is_valid_email(email):
            return {
                "success": False,
                "message": "Please provide a valid email address"
            }

        if not otp or not re.match(r"^\d{6}$", str(otp)):
            return {
                "success": False,
                "message": "Please provide a valid 6-digit OTP"
            }

        # Verify OTP
        result = otp_storage.verify_otp(email, str(otp))

        if result.get('success'):
            print(f"[SUCCESS] OTP verified successfully for {email}")
            return {
                "success": True,
                "message": "OTP verified successfully"
            }
        else:
            return {
                "success": False,
                "message": result.get('message') or "Invalid or expired OTP"
            }

    except Exception as e:
        print(f"[ERROR] Error in verify_otp_code: {e}")
        return {
            "success": False,
            "message": str(e) or "Failed to verify OTP. Please try again."
        }
