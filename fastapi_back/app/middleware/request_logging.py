import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.utils.app_logger import get_logger

log = get_logger("medclues.http")

_SKIP_PATHS = frozenset({"/health", "/ready"})


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in _SKIP_PATHS:
            return await call_next(request)

        request_id = (
            request.headers.get("X-Request-ID")
            or request.headers.get("X-Correlation-ID")
            or str(uuid.uuid4())
        )
        request.state.request_id = request_id

        start = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            elapsed_ms = (time.perf_counter() - start) * 1000
            log.info(
                "rid=%s %s %s %s %.1fms",
                request_id,
                request.method,
                request.url.path,
                status_code,
                elapsed_ms,
            )
