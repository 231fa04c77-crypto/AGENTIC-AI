"""Optional list pagination — backward compatible when limit is omitted."""
from __future__ import annotations

from typing import Any, Optional


DEFAULT_MAX_LIMIT = 200


def parse_pagination(
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    *,
    max_limit: int = DEFAULT_MAX_LIMIT,
) -> tuple[Optional[int], int]:
    """
    Returns (limit, offset).
    limit=None means caller should return full list (legacy behavior).
    """
    off = max(0, int(offset or 0))
    if limit is None:
        return None, off
    lim = max(1, min(int(limit), max_limit))
    return lim, off


def paginate_items(items: list[Any], limit: Optional[int], offset: int) -> list[Any]:
    if limit is None:
        return items
    return items[offset : offset + limit]


def pagination_meta(
    *,
    total: int,
    limit: Optional[int],
    offset: int,
    returned: int,
) -> dict[str, Any]:
    if limit is None:
        return {
            "total": total,
            "limit": None,
            "offset": 0,
            "returned": returned,
            "hasMore": False,
        }
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "returned": returned,
        "hasMore": offset + returned < total,
    }


def with_pagination(payload: dict[str, Any], meta: dict[str, Any]) -> dict[str, Any]:
    """Attach pagination block only when client requested limit."""
    if meta.get("limit") is not None:
        payload["pagination"] = meta
    return payload
