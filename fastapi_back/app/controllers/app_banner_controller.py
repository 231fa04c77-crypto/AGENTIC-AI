"""Home promo banners — public read + admin CRUD."""
from __future__ import annotations

from typing import Any, Optional

import cloudinary.uploader
from fastapi import UploadFile

from app.models import app_banner_model
from app.services import cache_keys as ck
from app.services import cache_service as cache
from app.services.cloudinary_folders import home_banners_folder


async def _invalidate() -> None:
    await cache.delete(ck.home_banners())


async def get_public_banners() -> dict[str, Any]:
    async def _load():
        try:
            banners = await app_banner_model.list_active_public()
            return {"success": True, "banners": banners}
        except Exception as e:
            return {"success": False, "message": str(e), "banners": []}

    return await cache.cache_aside(ck.home_banners(), ck.TTL_HOME_BANNERS, _load)


async def admin_list_banners() -> dict[str, Any]:
    try:
        banners = await app_banner_model.list_all_admin()
        return {"success": True, "banners": banners}
    except Exception as e:
        return {"success": False, "message": str(e), "banners": []}


async def admin_create_banner(
    data: dict[str, Any],
    image: Optional[UploadFile] = None,
) -> dict[str, Any]:
    try:
        if image and image.filename:
            raw = await image.read()
            up = cloudinary.uploader.upload(
                raw,
                folder=home_banners_folder(),
                resource_type="image",
            )
            data = {**data, "imageUrl": up.get("secure_url") or up.get("url")}
        banner = await app_banner_model.create_banner(data)
        await _invalidate()
        return {"success": True, "banner": banner}
    except Exception as e:
        return {"success": False, "message": str(e)}


async def admin_update_banner(
    banner_id: int,
    data: dict[str, Any],
    image: Optional[UploadFile] = None,
) -> dict[str, Any]:
    try:
        if image and image.filename:
            raw = await image.read()
            up = cloudinary.uploader.upload(
                raw,
                folder=home_banners_folder(),
                resource_type="image",
            )
            data = {**data, "imageUrl": up.get("secure_url") or up.get("url")}
        banner = await app_banner_model.update_banner(banner_id, data)
        if not banner:
            return {"success": False, "message": "Banner not found"}
        await _invalidate()
        return {"success": True, "banner": banner}
    except Exception as e:
        return {"success": False, "message": str(e)}


async def admin_delete_banner(banner_id: int) -> dict[str, Any]:
    try:
        await app_banner_model.delete_banner(banner_id)
        await _invalidate()
        return {"success": True, "message": "Banner deleted"}
    except Exception as e:
        return {"success": False, "message": str(e)}
