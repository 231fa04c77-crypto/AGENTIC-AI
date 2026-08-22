"""Async password helpers — keep bcrypt off the event loop."""
from __future__ import annotations

import asyncio
import bcrypt


def hash_password_sync(password: str, rounds: int = 10) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds)).decode("utf-8")


def verify_password_sync(password: str, hashed: str) -> bool:
    if not hashed:
        return False
    is_bcrypt = hashed.startswith("$2b$") or hashed.startswith("$2a$") or hashed.startswith("$2y$")
    if is_bcrypt:
        try:
            return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
        except Exception:
            return False
    return password == hashed


async def hash_password(password: str, rounds: int = 10) -> str:
    return await asyncio.to_thread(hash_password_sync, password, rounds)


async def verify_password(password: str, hashed: str) -> bool:
    return await asyncio.to_thread(verify_password_sync, password, hashed)
