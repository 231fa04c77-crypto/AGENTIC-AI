"""Block non-admin API traffic while platform maintenance mode is on."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

_ALLOW_PREFIXES = (
    "/api/admin",
    "/api/health",
    "/api/config",
    "/health",
    "/ready",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/socket.io",
)


def _is_allowed(path: str) -> bool:
    for prefix in _ALLOW_PREFIXES:
        if path == prefix or path.startswith(prefix + "/") or (
            prefix.endswith(".json") and path == prefix
        ):
            return True
        # Also match bare prefix without trailing slash for /api/admin etc.
        if path.startswith(prefix):
            return True
    return False


class MaintenanceModeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path or "/"
        if _is_allowed(path):
            return await call_next(request)

        try:
            from app.models import platform_settings_model

            if await platform_settings_model.is_maintenance_mode():
                return JSONResponse(
                    status_code=503,
                    content={
                        "success": False,
                        "message": "Platform is under maintenance. Please try again later.",
                        "maintenance": True,
                    },
                )
        except Exception:
            pass

        return await call_next(request)
