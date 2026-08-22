"""Safe Cloudinary upload helpers — size/MIME checks + thread offload."""
from __future__ import annotations

import asyncio
from typing import Any, Optional, Tuple

from fastapi import UploadFile

from app.config.config import settings


class UploadRejected(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def _mime_allowed(content_type: Optional[str]) -> bool:
    if not content_type:
        return False
    prefixes = getattr(settings, "ALLOWED_UPLOAD_MIME_PREFIXES", ("image/", "application/pdf"))
    ct = content_type.lower().strip()
    return any(ct.startswith(p.lower()) for p in prefixes)


async def read_upload_limited(file: UploadFile) -> Tuple[bytes, str, Optional[str]]:
    """Read upload with max-byte and MIME checks."""
    max_bytes = int(getattr(settings, "MAX_UPLOAD_BYTES", 10 * 1024 * 1024) or 10 * 1024 * 1024)
    content_type = file.content_type
    if not _mime_allowed(content_type):
        raise UploadRejected(
            f"Unsupported file type ({content_type or 'unknown'}). "
            "Allowed: images and PDF."
        )
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise UploadRejected(
                f"File too large. Maximum size is {max_bytes // (1024 * 1024)} MB."
            )
        chunks.append(chunk)
    data = b"".join(chunks)
    if not data:
        raise UploadRejected("Empty file upload.")
    return data, file.filename or "upload", content_type


async def cloudinary_upload_bytes(
    data: bytes,
    *,
    folder: str,
    resource_type: str = "auto",
) -> dict[str, Any]:
    """Run sync Cloudinary upload off the event loop."""
    import cloudinary.uploader

    def _do():
        return cloudinary.uploader.upload(
            data,
            folder=folder,
            resource_type=resource_type,
        )

    return await asyncio.to_thread(_do)
