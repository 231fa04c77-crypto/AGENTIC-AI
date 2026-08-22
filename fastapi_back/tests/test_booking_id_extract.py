"""Tests for booking ID extract / normalize helpers."""
from app.utils.booking_id import (
    extract_booking_id,
    is_valid_booking_id,
    looks_like_visit_summary_payload,
    normalize_booking_id,
)


def test_normalize_and_valid():
    assert normalize_booking_id(" bk8x4p2q ") == "BK8X4P2Q"
    assert is_valid_booking_id("BK8X4P2Q")
    assert not is_valid_booking_id("BK-2025-0001")


def test_extract_from_url_and_json():
    assert extract_booking_id("BK8X4P2Q") == "BK8X4P2Q"
    assert (
        extract_booking_id(
            "https://example.com/#/a/BK8X4P2Q?sig=abc"
        )
        == "BK8X4P2Q"
    )
    assert (
        extract_booking_id(
            "http://localhost:5000/link/appointment-summary/BKTEST01?sig=x"
        )
        == "BKTEST01"
    )
    assert (
        extract_booking_id('{"type":"appointment","bookingId":"BKZZZZ99"}')
        == "BKZZZZ99"
    )


def test_visit_summary_detection():
    assert looks_like_visit_summary_payload(
        "https://x/#/a/BK8X4P2Q?sig=abc"
    )
    assert looks_like_visit_summary_payload(
        "/link/appointment-summary/BK8X4P2Q?sig=1"
    )
    assert not looks_like_visit_summary_payload("BK8X4P2Q")
