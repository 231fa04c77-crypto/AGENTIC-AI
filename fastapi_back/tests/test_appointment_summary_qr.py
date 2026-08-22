"""Unit tests for appointment summary QR HMAC helpers."""
from app.utils.appointment_summary_qr import (
    build_appointment_summary_url,
    sign_appointment_summary,
    verify_appointment_summary_sig,
)


def test_sign_and_verify_roundtrip():
    code = "BK8X4P2Q"
    sig = sign_appointment_summary(code)
    assert sig
    assert verify_appointment_summary_sig(code, sig)
    assert not verify_appointment_summary_sig(code, "tampered")
    assert not verify_appointment_summary_sig("BKZZZZZZ", sig)


def test_build_url_contains_booking_and_sig():
    code = "BKTEST01"
    url = build_appointment_summary_url(code)
    assert code in url
    assert "sig=" in url
    assert "/a/" in url or "/link/appointment-summary/" in url
