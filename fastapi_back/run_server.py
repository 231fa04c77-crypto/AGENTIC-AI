"""Dev server entrypoint with quiet Ctrl+C / reload shutdown on Windows.

Prefer this over `python -m uvicorn ...` so KeyboardInterrupt from uvicorn
does not dump a scary ERROR traceback when you stop the API.

Usage (from fastapi_back):
  python run_server.py
"""
from __future__ import annotations

import asyncio
import sys


def main() -> None:
    import uvicorn
    from app.config.config import settings

    # Avoid printing CancelledError / KeyboardInterrupt as uncaught crashes.
    def _quiet_hook(exc_type, exc, tb):
        if issubclass(exc_type, KeyboardInterrupt):
            return
        if issubclass(exc_type, asyncio.CancelledError):
            return
        sys.__excepthook__(exc_type, exc, tb)

    sys.excepthook = _quiet_hook

    config = uvicorn.Config(
        "main:app",
        host="0.0.0.0",
        port=int(settings.PORT),
        reload=True,
        # Keep default log level; we only silence expected stop signals.
    )
    server = uvicorn.Server(config)
    try:
        server.run()
    except KeyboardInterrupt:
        # Expected when stopping the reloader / worker on Windows.
        pass
    finally:
        print("Backend stopped.", flush=True)


if __name__ == "__main__":
    main()
