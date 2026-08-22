"""Entity Dictionary schemas — Module 4."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class EntityRecord:
    id: str
    canonical: str
    category: str
    normalized: str = ""
    aliases: tuple[str, ...] = ()
    synonyms: tuple[str, ...] = ()
    abbreviations: tuple[str, ...] = ()
    misspellings: tuple[str, ...] = ()
    plurals: tuple[str, ...] = ()
    metadata: dict[str, Any] = field(default_factory=dict)
    aliases_hi: tuple[str, ...] = ()
    aliases_te: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not self.normalized:
            object.__setattr__(self, "normalized", self.canonical)

    def all_terms(self) -> tuple[str, ...]:
        terms = [
            self.canonical,
            self.normalized,
            self.id.replace("_", " "),
            *self.aliases,
            *self.synonyms,
            *self.abbreviations,
            *self.misspellings,
            *self.plurals,
            *self.aliases_hi,
            *self.aliases_te,
        ]
        # Preserve order, drop empties / dupes (case-insensitive)
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
        d = asdict(self)
        return d


@dataclass
class EntityMatch:
    entity: str
    normalized: str
    aliases: list[str]
    misspellings: list[str]
    category: str
    confidence: float
    match_type: str
    record_id: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "entity": self.entity,
            "normalized": self.normalized,
            "aliases": list(self.aliases),
            "misspellings": list(self.misspellings),
            "category": self.category,
            "confidence": self.confidence,
            "match_type": self.match_type,
            "record_id": self.record_id,
            "metadata": dict(self.metadata),
        }


@dataclass
class EntityCatalog:
    version: int = 1
    # category -> id -> record
    by_category: dict[str, dict[str, EntityRecord]] = field(default_factory=dict)
    # lower term -> list of (category, id)
    index: dict[str, list[tuple[str, str]]] = field(default_factory=dict)
    # all searchable terms for fuzzy
    all_terms: list[str] = field(default_factory=list)
    load_ms: float = 0.0

    def get(self, category: str, entity_id: str) -> EntityRecord | None:
        return (self.by_category.get(category) or {}).get(entity_id)

    def list_category(self, category: str) -> list[EntityRecord]:
        return list((self.by_category.get(category) or {}).values())

    def categories(self) -> list[str]:
        return list(self.by_category.keys())

    def count(self) -> int:
        return sum(len(v) for v in self.by_category.values())
