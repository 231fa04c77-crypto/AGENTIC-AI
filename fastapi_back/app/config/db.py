import asyncio
import socket
from typing import Optional
import asyncpg
from .config import settings

_TRANSIENT = (
    OSError,
    socket.gaierror,
    asyncpg.PostgresConnectionError,
    asyncpg.InterfaceError,
    asyncpg.TooManyConnectionsError,
    ConnectionError,
    TimeoutError,
    asyncio.TimeoutError,
)


def _is_timeout(exc: BaseException) -> bool:
    return isinstance(exc, (TimeoutError, asyncio.TimeoutError))


def _is_neon_url(url: str) -> bool:
    return "neon.tech" in (url or "") or "neon.tech" in (settings.PG_HOST or "")


def _is_transient(exc: BaseException) -> bool:
    if isinstance(exc, _TRANSIENT):
        return True
    msg = str(exc).lower()
    return any(
        token in msg
        for token in (
            "getaddrinfo",
            "connection was closed",
            "connection does not exist",
            "another operation is in progress",
            "too many connections",
            "timeout",
        )
    )


class Database:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self.read_pool: Optional[asyncpg.Pool] = None
        self._lock = asyncio.Lock()

    def _pool_kwargs(self, url: str) -> dict:
        neon = _is_neon_url(url)
        min_size = int(getattr(settings, "DB_POOL_MIN", 1) or 1)
        max_size = int(getattr(settings, "DB_POOL_MAX", 8) or 8)
        if neon:
            min_size = 1
            max_size = max(2, min(max_size, 4))
        else:
            min_size = max(1, min_size)
            max_size = max(min_size + 1, max_size)
        return {
            "min_size": min_size,
            "max_size": max_size,
            "timeout": 8,
            "command_timeout": 12,
            "max_inactive_connection_lifetime": 240,
            "max_queries": 50000,
            "statement_cache_size": 0 if neon else 100,
        }

    async def _init_connection(self, conn: asyncpg.Connection) -> None:
        await conn.execute("SET statement_timeout = '8000'")
        await conn.execute("SET idle_in_transaction_session_timeout = '10000'")

    async def connect(self, retries: int = 3):
        if self.pool:
            await self._ensure_read_pool()
            return True

        async with self._lock:
            if self.pool:
                return True
            last_error = None
            db_url = settings.DATABASE_URL or ""
            kwargs = self._pool_kwargs(db_url)
            for attempt in range(1, retries + 1):
                try:
                    if db_url:
                        ssl_mode = "require" if _is_neon_url(db_url) else (True if settings.PG_SSL else False)
                        self.pool = await asyncpg.create_pool(
                            db_url,
                            ssl=ssl_mode,
                            init=self._init_connection,
                            **kwargs,
                        )
                    else:
                        self.pool = await asyncpg.create_pool(
                            user=settings.PG_USER,
                            password=settings.PG_PASSWORD,
                            database=settings.PG_DATABASE,
                            host=settings.PG_HOST,
                            port=settings.PG_PORT,
                            ssl=settings.PG_SSL,
                            init=self._init_connection,
                            **kwargs,
                        )
                    print("PostgreSQL connected successfully (Python)")
                    await self._ensure_read_pool()
                    return True
                except Exception as e:
                    last_error = e
                    self.pool = None
                    print(f"PostgreSQL connection error (attempt {attempt}/{retries}): {e}")
                    if attempt < retries:
                        await asyncio.sleep(min(2 * attempt, 4))

            print(f"PostgreSQL connection failed after {retries} attempts: {last_error}")
            return False

    async def _reset_pool(self) -> None:
        pool = self.pool
        self.pool = None
        if pool is not None:
            try:
                await pool.close()
            except Exception:
                pass

    async def _ensure_read_pool(self):
        if self.read_pool:
            return
        read_url = (getattr(settings, "DATABASE_READ_URL", None) or "").strip()
        if not read_url or read_url == (settings.DATABASE_URL or "").strip():
            return
        try:
            kwargs = self._pool_kwargs(read_url)
            kwargs["min_size"] = 1
            kwargs["max_size"] = max(2, kwargs["max_size"] // 2)
            self.read_pool = await asyncpg.create_pool(
                read_url,
                ssl="require" if _is_neon_url(read_url) else (True if settings.PG_SSL else False),
                init=self._init_connection,
                **kwargs,
            )
            print("PostgreSQL read replica pool ready")
        except Exception as e:
            self.read_pool = None
            print(f"Read replica pool skipped: {e}")

    async def disconnect(self):
        if self.read_pool:
            await self.read_pool.close()
            self.read_pool = None
        if self.pool:
            await self.pool.close()
            self.pool = None
            print("PostgreSQL pool closed")

    async def _with_conn(self, op: str, sql, *args, args_list=None):
        last_error = None
        for attempt in range(1, 4):
            try:
                if not self.pool:
                    ok = await self.connect()
                    if not ok or not self.pool:
                        raise ConnectionError("PostgreSQL is unavailable")
                async with self.pool.acquire(timeout=4) as connection:
                    if op == "fetch":
                        return await connection.fetch(sql, *args)
                    if op == "execute":
                        return await connection.execute(sql, *args)
                    if op == "fetchrow":
                        return await connection.fetchrow(sql, *args)
                    return await connection.executemany(sql, args_list)
            except Exception as e:
                last_error = e
                # Pool wait timeouts must not retry 3x (that is 12s+ of UI lag).
                if _is_timeout(e) or not _is_transient(e) or attempt == 3:
                    raise
                await asyncio.sleep(0.15 * attempt)
                if attempt >= 2 and not isinstance(e, (socket.gaierror, OSError)):
                    async with self._lock:
                        await self._reset_pool()
        raise last_error

    async def query(self, sql, *args):
        return await self._with_conn("fetch", sql, *args)

    async def execute(self, sql, *args):
        return await self._with_conn("execute", sql, *args)

    async def fetch_row(self, sql, *args):
        return await self._with_conn("fetchrow", sql, *args)

    async def executemany(self, sql, args_list):
        return await self._with_conn("executemany", sql, args_list=args_list)

    async def fetch_all(self, sql, *args):
        return await self.query(sql, *args)

    async def fetch_one(self, sql, *args):
        return await self.fetch_row(sql, *args)


db = Database()
