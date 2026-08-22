"""Simple circuit breaker for outbound partner HTTP calls.

Additive resilience — callers fall back to open/half-open without changing APIs.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from app.utils.app_logger import get_logger

log = get_logger(__name__)


@dataclass
class _BreakerState:
    failures: int = 0
    opened_at: float = 0.0
    state: str = "closed"  # closed | open | half_open


_breakers: dict[str, _BreakerState] = {}


@dataclass
class CircuitBreaker:
    name: str
    failure_threshold: int = 5
    recovery_seconds: float = 30.0

    def allow(self) -> bool:
        st = _breakers.setdefault(self.name, _BreakerState())
        if st.state == "open":
            if time.time() - st.opened_at >= self.recovery_seconds:
                st.state = "half_open"
                return True
            return False
        return True

    def record_success(self) -> None:
        st = _breakers.setdefault(self.name, _BreakerState())
        st.failures = 0
        st.state = "closed"

    def record_failure(self) -> None:
        st = _breakers.setdefault(self.name, _BreakerState())
        st.failures += 1
        if st.failures >= self.failure_threshold or st.state == "half_open":
            st.state = "open"
            st.opened_at = time.time()
            log.warning("Circuit open for %s after %s failures", self.name, st.failures)


def get_breaker(name: str, **kwargs: Any) -> CircuitBreaker:
    return CircuitBreaker(name=name, **kwargs)


def snapshot() -> dict[str, dict]:
    return {
        k: {"state": v.state, "failures": v.failures, "opened_at": v.opened_at}
        for k, v in _breakers.items()
    }
