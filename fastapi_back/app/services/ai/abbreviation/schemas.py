"""Module 6 — Abbreviation Engine schemas."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class AbbreviationRecord:
    id: str
    abbreviation: str
    expanded: str
    canonical: str
    category: str
    aliases: tuple[str, ...] = ()
    contexts: tuple[str, ...] = ()
    sense_id: str = ""
    aliases_hi: tuple[str, ...] = ()
    aliases_te: tuple[str, ...] = ()

    def source_keys(self) -> tuple[str, ...]:
        keys = [self.abbreviation, *self.aliases]
        seen: set[str] = set()
        out: list[str] = []
        for k in keys:
            low = str(k).strip().lower()
            if not low or low in seen:
                continue
            seen.add(low)
            out.append(str(k).strip())
        return tuple(out)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class AbbreviationMatch:
    abbreviation: str
    expanded: str
    canonical: str
    category: str
    confidence: float
    matched_by: str
    record_id: str = ""
    requires_clarification: bool = False
    possible_values: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "abbreviation": self.abbreviation,
            "expanded": self.expanded,
            "canonical": self.canonical,
            "category": self.category,
            "confidence": round(self.confidence, 3),
            "matched_by": self.matched_by,
            "record_id": self.record_id,
            "requires_clarification": self.requires_clarification,
            "possible_values": list(self.possible_values),
        }


@dataclass
class ExpandResult:
    original_text: str
    expanded_text: str
    expansions: list[AbbreviationMatch] = field(default_factory=list)
    processing_ms: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "original_text": self.original_text,
            "expanded_text": self.expanded_text,
            "expansions": [e.to_dict() for e in self.expansions],
            "processing_ms": round(self.processing_ms, 3),
        }


@dataclass
class AbbreviationIndex:
    version: int = 1
    records: dict[str, AbbreviationRecord] = field(default_factory=dict)
    # lower abbr -> list of record ids (multiple = ambiguous)
    by_abbr: dict[str, list[str]] = field(default_factory=dict)
    load_ms: float = 0.0

    def count(self) -> int:
        return len(self.records)
