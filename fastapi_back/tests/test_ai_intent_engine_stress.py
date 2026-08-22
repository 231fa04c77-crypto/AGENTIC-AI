"""Stress / latency smoke for Module 1 Intent Engine."""
from __future__ import annotations

import statistics
import time

from app.services.ai.intent import detect_intents

_SAMPLES = [
    "Book appointment tomorrow",
    "Cancel my booking",
    "Need dermatologist",
    "Search medicine",
    "What is diabetes",
    "Hi",
    "Thank you",
    "Open pharmacy",
    "Book blood test",
    "Chest pain",
    "Need ambulance",
    "Track complaint",
    "asdf qwer zxcv",
    "I want to book a dermatologist and also know what diabetes is",
    "Need dermotologist",
    "Book CBC",
    "Show reports",
    "Open dashboard",
    "How are you",
    "Good morning",
]


def test_stress_thousands_of_messages_latency():
    messages = (_SAMPLES * 150)[:3000]  # 3000 messages
    times: list[float] = []
    for msg in messages:
        t0 = time.perf_counter()
        r = detect_intents(msg)
        times.append((time.perf_counter() - t0) * 1000)
        assert r.primary_intent
        assert isinstance(r.confidence, dict)

    mean_ms = statistics.mean(times)
    p95 = sorted(times)[int(len(times) * 0.95)]
    assert mean_ms < 5.0, f"mean {mean_ms:.3f} ms too high"
    assert p95 < 20.0, f"p95 {p95:.3f} ms too high"
