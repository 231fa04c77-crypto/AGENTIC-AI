"""Apply schema-only SQL using the same DB helper as the FastAPI app."""
from __future__ import annotations

import asyncio
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from app.config.db import db  # noqa: E402

SQL_PATH = ROOT / "schema_tables_only_utf8.sql"


def split_sql(sql: str) -> list[str]:
    parts: list[str] = []
    buf: list[str] = []
    in_dollar = False
    i = 0
    while i < len(sql):
        if sql[i : i + 2] == "$$":
            in_dollar = not in_dollar
            buf.append("$$")
            i += 2
            continue
        ch = sql[i]
        if ch == ";" and not in_dollar:
            stmt = "".join(buf).strip()
            if stmt:
                parts.append(stmt)
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    tail = "".join(buf).strip()
    if tail:
        parts.append(tail)
    return parts


async def main() -> None:
    if not SQL_PATH.exists():
        raise SystemExit(f"Missing {SQL_PATH}")

    ok_conn = await db.connect()
    if not ok_conn:
        raise SystemExit("Could not connect to DATABASE_URL")

    parts = split_sql(SQL_PATH.read_text(encoding="utf-8"))
    ok = fail = skip = 0
    errors: list[str] = []

    for stmt in parts:
        low = stmt.lower().lstrip()
        if low.startswith("select pg_catalog"):
            try:
                await db.execute(stmt)
            except Exception:
                pass
            skip += 1
            continue
        try:
            await db.execute(stmt)
            ok += 1
        except Exception as e:
            msg = str(e)
            if "already exists" in msg:
                skip += 1
                continue
            fail += 1
            errors.append(msg[:200])

    rows = await db.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1"
    )
    await db.disconnect()

    print(f"ok={ok} skip={skip} fail={fail}")
    print(f"public_tables={len(rows)}")
    print("tables=" + ", ".join(r["tablename"] for r in rows))
    if errors:
        print("sample_errors:")
        for e in errors[:12]:
            print(" -", e)


if __name__ == "__main__":
    asyncio.run(main())
