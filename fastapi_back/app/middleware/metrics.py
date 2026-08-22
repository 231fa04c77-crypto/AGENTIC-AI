"""Lightweight Prometheus metrics for API / workers."""
from __future__ import annotations

import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

try:
    from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
except ImportError:  # optional until pip install
    Counter = Histogram = None  # type: ignore
    generate_latest = None  # type: ignore
    CONTENT_TYPE_LATEST = "text/plain"


REQUEST_COUNT = (
    Counter(
        "medclues_http_requests_total",
        "HTTP requests",
        ["method", "path", "status"],
    )
    if Counter
    else None
)
REQUEST_LATENCY = (
    Histogram(
        "medclues_http_request_duration_seconds",
        "HTTP request latency",
        ["method", "path"],
        buckets=(0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
    )
    if Histogram
    else None
)


class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if REQUEST_COUNT is None:
            return await call_next(request)
        path = request.url.path
        if path in ("/metrics", "/health", "/ready"):
            return await call_next(request)
        # Collapse dynamic segments lightly
        label_path = path if path.count("/") <= 4 else "/".join(path.split("/")[:4]) + "/*"
        start = time.perf_counter()
        response = await call_next(request)
        elapsed = time.perf_counter() - start
        try:
            REQUEST_COUNT.labels(request.method, label_path, str(response.status_code)).inc()
            REQUEST_LATENCY.labels(request.method, label_path).observe(elapsed)
        except Exception:
            pass
        return response


def metrics_response() -> Response:
    if generate_latest is None:
        return Response(
            content="# prometheus_client not installed\n",
            media_type="text/plain",
            status_code=501,
        )
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
