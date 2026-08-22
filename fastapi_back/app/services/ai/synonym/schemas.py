"""Module 5 — Synonym Engine schemas."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class SynonymRecord:
    id: str
    canonical: str
    category: str
    synonyms: tuple[str, ...] = ()
    aliases: tuple[str, ...] = ()
    abbreviations: tuple[str, ...] = ()
    misspellings: tuple[str, ...] = ()
    plurals: tuple[str, ...] = ()
    regions: tuple[str, ...] = ()

    def all_source_terms(self) -> tuple[str, ...]:
        terms = [
            *self.synonyms,
            *self.aliases,
            *self.abbreviations,
            *self.misspellings,
            *self.plurals,
            self.canonical,
        ]
        seen: set[str] = set()
        out: list[str] = []
        for t in terms:
            key = str(t).strip()
            if not key:
                continue
            low = key.lower()
            if low in seen:
                continue
            seen.add(low)
            out.append(key)
        return tuple(out)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class SynonymMatch:
    original: str
    canonical: str
    category: str
    confidence: float
    matched_by: str  # exact | synonym | alias | abbreviation | misspelling | plural | fuzzy | entity_dictionary
    record_id: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "original": self.original,
            "canonical": self.canonical,
            "category": self.category,
            "confidence": round(self.confidence, 3),
            "matched_by": self.matched_by,
            "record_id": self.record_id,
        }


@dataclass
class NormalizeResult:
    original_text: str
    normalized_text: str
    resolutions: list[SynonymMatch] = field(default_factory=list)
    processing_ms: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "original_text": self.original_text,
            "normalized_text": self.normalized_text,
            "resolutions": [r.to_dict() for r in self.resolutions],
            "processing_ms": round(self.processing_ms, 3),
        }


@dataclass
class SynonymIndex:
    version: int = 1
    region: str = "IN"
    # id -> record
    records: dict[str, SynonymRecord] = field(default_factory=dict)
    # lower source term -> list of record ids
    term_to_ids: dict[str, list[str]] = field(default_factory=dict)
    # term -> matched_by hint if known from which list
    term_kind: dict[str, str] = field(default_factory=dict)
    all_terms: list[str] = field(default_factory=list)
    # canonical lower -> id (for cycle detection)
    canonical_to_id: dict[str, str] = field(default_factory=dict)
    load_ms: float = 0.0

    def count(self) -> int:
        return len(self.records)
