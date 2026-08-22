"""Apply numbered SQL migrations from fastapi_back/migrations/."""
from __future__ import annotations

from pathlib import Path

from app.config.db import db
from app.utils.app_logger import get_logger

log = get_logger(__name__)

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "migrations"


async def ensure_schema_migrations_table() -> None:
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id          SERIAL PRIMARY KEY,
            version     VARCHAR(64) NOT NULL UNIQUE,
            applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )


async def _applied_versions() -> set[str]:
    rows = await db.query("SELECT version FROM schema_migrations")
    return {row["version"] for row in rows}


async def _mark_applied(version: str) -> None:
    await db.execute(
        "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING",
        version,
    )


def _split_sql_statements(sql: str) -> list[str]:
    """Split on ';' while respecting $$ dollar-quotes and single-quoted strings.

    Also strips full-line `--` comments before returning each statement.
    """
    statements: list[str] = []
    buf: list[str] = []
    i = 0
    n = len(sql)
    in_single = False
    in_dollar = False

    while i < n:
        ch = sql[i]
        nxt = sql[i + 1] if i + 1 < n else ""

        if in_dollar:
            if ch == "$" and nxt == "$":
                buf.append("$$")
                i += 2
                in_dollar = False
                continue
            buf.append(ch)
            i += 1
            continue

        if in_single:
            buf.append(ch)
            if ch == "'" and nxt == "'":
                # Escaped '' inside string
                buf.append(nxt)
                i += 2
                continue
            if ch == "'":
                in_single = False
            i += 1
            continue

        # Start of dollar-quote body ($$ ... $$)
        if ch == "$" and nxt == "$":
            buf.append("$$")
            i += 2
            in_dollar = True
            continue

        if ch == "'":
            buf.append(ch)
            in_single = True
            i += 1
            continue

        # Line comment — consume until newline (do not treat ; inside as split)
        if ch == "-" and nxt == "-":
            while i < n and sql[i] != "\n":
                buf.append(sql[i])
                i += 1
            continue

        if ch == ";":
            stmt = "".join(buf).strip()
            if stmt:
                lines = [
                    ln
                    for ln in stmt.splitlines()
                    if ln.strip() and not ln.strip().startswith("--")
                ]
                if lines:
                    statements.append("\n".join(lines))
            buf = []
            i += 1
            continue

        buf.append(ch)
        i += 1

    tail = "".join(buf).strip()
    if tail:
        lines = [
            ln for ln in tail.splitlines() if ln.strip() and not ln.strip().startswith("--")
        ]
        if lines:
            statements.append("\n".join(lines))
    return statements


async def _run_sql_file(path: Path) -> None:
    sql = path.read_text(encoding="utf-8").strip()
    if not sql:
        return
    if not db.pool:
        await db.connect()
    statements = _split_sql_statements(sql)
    async with db.pool.acquire() as conn:
        for stmt in statements:
            await conn.execute(stmt)


async def run_pending_migrations() -> list[str]:
    """Returns list of migration versions applied in this run."""
    if not db.pool:
        connected = await db.connect()
        if not connected:
            log.warning("Migrations skipped — database not connected")
            return []

    await ensure_schema_migrations_table()
    applied_before = await _applied_versions()
    newly_applied: list[str] = []

    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        version = path.stem
        if version in applied_before:
            continue
        try:
            log.info("Applying migration %s", version)
            await _run_sql_file(path)
            if version in ("006_performance_indexes", "007_foreign_keys"):
                from app.db.schema_hardening import apply_optional_indexes, apply_foreign_keys_safe
                await apply_optional_indexes()
            if version == "007_foreign_keys":
                from app.db.schema_hardening import apply_foreign_keys_safe
                await apply_foreign_keys_safe()
            await _mark_applied(version)
            newly_applied.append(version)
            log.info("Migration %s applied", version)
        except Exception as exc:
            log.error("Migration %s failed: %s", version, exc)
            raise

    return newly_applied
