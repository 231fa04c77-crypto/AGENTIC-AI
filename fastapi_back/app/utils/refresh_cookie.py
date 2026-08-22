"""HttpOnly cookie helpers for refresh tokens (web clients)."""
from fastapi import Request, Response

from app.config.config import settings

# Role-scoped cookie names — avoids cross-role token reuse on shared origins.
COOKIE_NAMES = {
    "patient": "medclues_rt_patient",
    "admin": "medclues_rt_admin",
    "doctor": "medclues_rt_doctor",
    "dean": "medclues_rt_dean",
}


def uses_cookie_storage(request: Request | None) -> bool:
    if request is None:
        return False
    mode = (request.headers.get("x-auth-storage") or "").strip().lower()
    if mode == "cookie":
        return True
    if mode == "body":
        return False
    platform = (request.headers.get("x-client-platform") or "").strip().lower()
    return platform == "web"


def cookie_name_for_role(role: str) -> str:
    role = (role or "patient").strip().lower()
    return COOKIE_NAMES.get(role, COOKIE_NAMES["patient"])


def get_refresh_from_cookie(request: Request | None, role: str) -> str | None:
    if request is None:
        return None
    name = cookie_name_for_role(role)
    value = request.cookies.get(name)
    return value.strip() if value else None


def set_refresh_cookie(response: Response, role: str, refresh_token: str) -> None:
    max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    response.set_cookie(
        key=cookie_name_for_role(role),
        value=refresh_token,
        max_age=max_age,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="lax",
        path="/",
    )


def clear_refresh_cookie(response: Response, role: str) -> None:
    response.delete_cookie(
        key=cookie_name_for_role(role),
        path="/",
        httponly=True,
        secure=not settings.DEBUG,
        samesite="lax",
    )
