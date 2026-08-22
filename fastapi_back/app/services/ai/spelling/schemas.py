"""Module 7 — Spelling Correction schemas."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class SpellingEntry:
    id: str
    canonical: str
    category: str
    misspellings: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class SpellingCorrection:
    original: str
    corrected: str
    confidence: float
    category: str = ""
    matched_by: str = "dictionary"

    def to_dict(self) -> dict[str, Any]:
        return {
            "original": self.original,
            "corrected": self.corrected,
            "confidence": round(self.confidence, 3),
            "category": self.category,
            "matched_by": self.matched_by,
        }


@dataclass
class CorrectResult:
    original: str
    corrected: str
    corrections: list[SpellingCorrection] = field(default_factory=list)
    requires_confirmation: bool = False
    processing_ms: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "original": self.original,
            "corrected": self.corrected,
            "corrections": [c.to_dict() for c in self.corrections],
            "requires_confirmation": self.requires_confirmation,
            "processing_ms": round(self.processing_ms, 3),
        }


@dataclass
class SpellingDictionary:
    version: int = 1
    entries: dict[str, SpellingEntry] = field(default_factory=dict)
    # misspelling lower -> entry id
    misspell_index: dict[str, str] = field(default_factory=dict)
    # all canonicals for fuzzy
    lexicon: list[str] = field(default_factory=list)
    load_ms: float = 0.0

    def count(self) -> int:
        return len(self.entries)
