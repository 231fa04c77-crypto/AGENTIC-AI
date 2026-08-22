"""Cloudinary Media Library folder paths — one subfolder per patient/doctor public_id."""
from __future__ import annotations

from typing import Any, Mapping, Optional

ROOT = "medclues"


def _segment(public_id: Optional[str], entity_id: Optional[int], prefix: str) -> str:
    pid = (public_id or "").strip()
    if pid:
        safe = "".join(c for c in pid if c.isalnum() or c in "-_")
        if safe:
            return safe
    if entity_id is not None:
        return f"{prefix}_{int(entity_id)}"
    return f"{prefix}_unknown"


def _from_row(row: Optional[Mapping[str, Any]], id_key: str, prefix: str) -> str:
    if not row:
        return f"{prefix}_unknown"
    return _segment(row.get("public_id"), row.get(id_key), prefix)


def patient_segment(
    user: Optional[Mapping[str, Any]] = None,
    *,
    user_id: Optional[int] = None,
    public_id: Optional[str] = None,
) -> str:
    if public_id:
        return _segment(public_id, None, "user")
    if user:
        return _from_row(user, "id", "user")
    if user_id is not None:
        return f"user_{int(user_id)}"
    return "user_unknown"


def doctor_segment(
    doctor: Optional[Mapping[str, Any]] = None,
    *,
    doctor_id: Optional[int] = None,
    public_id: Optional[str] = None,
) -> str:
    if public_id:
        return _segment(public_id, None, "doc")
    if doctor:
        return _from_row(doctor, "id", "doc")
    if doctor_id is not None:
        return f"doc_{int(doctor_id)}"
    return "doc_unknown"


def patient_profile_folder(
    user: Optional[Mapping[str, Any]] = None,
    *,
    user_id: Optional[int] = None,
    public_id: Optional[str] = None,
) -> str:
    return f"{ROOT}/patients/{patient_segment(user, user_id=user_id, public_id=public_id)}/profile"


def patient_reports_folder(
    user: Optional[Mapping[str, Any]] = None,
    *,
    user_id: Optional[int] = None,
    public_id: Optional[str] = None,
) -> str:
    return f"{ROOT}/patients/{patient_segment(user, user_id=user_id, public_id=public_id)}/reports"


def doctor_profile_folder(
    doctor: Optional[Mapping[str, Any]] = None,
    *,
    doctor_id: Optional[int] = None,
    public_id: Optional[str] = None,
) -> str:
    return f"{ROOT}/doctors/{doctor_segment(doctor, doctor_id=doctor_id, public_id=public_id)}/profile"


def doctor_documents_folder(
    doctor: Optional[Mapping[str, Any]] = None,
    *,
    doctor_id: Optional[int] = None,
    public_id: Optional[str] = None,
) -> str:
    return f"{ROOT}/doctors/{doctor_segment(doctor, doctor_id=doctor_id, public_id=public_id)}/documents"


def job_applications_folder() -> str:
    return f"{ROOT}/job-applications"


def home_banners_folder() -> str:
    return f"{ROOT}/branding/home_banners"
