"""Safe FK and optional index application — skips when schema/data not ready."""
from app.config.db import db
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_OPTIONAL_INDEXES = (
    ("appointments", "hospital_id", "idx_appointments_hospital_id"),
)

_FK_SPECS = (
    ("appointments", "user_id", "users", "id", "fk_appt_user"),
    ("health_records", "user_id", "users", "id", "fk_hr_user"),
    ("emergency_contacts", "user_id", "users", "id", "fk_ec_user"),
    ("consultations", "user_id", "users", "id", "fk_consult_user"),
)


async def _constraint_exists(name: str) -> bool:
    row = await db.fetch_row(
        "SELECT 1 FROM pg_constraint WHERE conname = $1 LIMIT 1",
        name,
    )
    return row is not None


async def _orphan_count(table: str, column: str, ref_table: str, ref_column: str) -> int:
    row = await db.fetch_row(
        f"""
        SELECT COUNT(*)::int AS c
        FROM {table} t
        WHERE t.{column} IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM {ref_table} r WHERE r.{ref_column} = t.{column}
          )
        """
    )
    return int(row["c"]) if row else 0


async def _column_exists(table: str, column: str) -> bool:
    row = await db.fetch_row(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
        LIMIT 1
        """,
        table,
        column,
    )
    return row is not None


async def apply_optional_indexes() -> None:
    for table, column, index_name in _OPTIONAL_INDEXES:
        try:
            if not await _column_exists(table, column):
                continue
            await db.execute(
                f"CREATE INDEX IF NOT EXISTS {index_name} ON {table} ({column})"
            )
            log.info("Index %s applied", index_name)
        except Exception as exc:
            log.warning("Index %s not applied: %s", index_name, exc)


async def apply_foreign_keys_safe() -> None:
    await apply_optional_indexes()
    for table, column, ref_table, ref_column, constraint_name in _FK_SPECS:
        try:
            if await _constraint_exists(constraint_name):
                continue
            orphans = await _orphan_count(table, column, ref_table, ref_column)
            if orphans > 0:
                log.warning(
                    "Skipping FK %s — %s orphan row(s) in %s.%s",
                    constraint_name,
                    orphans,
                    table,
                    column,
                )
                continue
            await db.execute(
                f"""
                ALTER TABLE {table}
                ADD CONSTRAINT {constraint_name}
                FOREIGN KEY ({column}) REFERENCES {ref_table}({ref_column})
                """
            )
            log.info("FK %s applied", constraint_name)
        except Exception as exc:
            log.warning("FK %s not applied: %s", constraint_name, exc)
