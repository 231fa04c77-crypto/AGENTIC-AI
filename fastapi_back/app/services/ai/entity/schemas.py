"""Module 2 — Entity Extraction schemas (no business actions)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class EntityError:
    code: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return {"code": self.code, "message": self.message}


@dataclass
class EntitySpan:
    """One extracted entity with optional confidence."""

    type: str
    value: Any
    confidence: float = 0.8
    source: str = "rules"  # rules | symptom_map | abbrev

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "value": self.value,
            "confidence": round(self.confidence, 3),
            "source": self.source,
        }


@dataclass
class EntityResult:
    """Structured entities for downstream Workflow / Tool Router modules."""

    entities: dict[str, Any] = field(default_factory=dict)
    spans: list[EntitySpan] = field(default_factory=list)
    missing_for_booking: list[str] = field(default_factory=list)
    processing_ms: float = 0.0
    normalized_message: str = ""
    language: str = "en"
    error: Optional[EntityError] = None
    original_message: str = ""
    synonym_resolutions: list[dict[str, Any]] = field(default_factory=list)
    abbreviation_expansions: list[dict[str, Any]] = field(default_factory=list)
    spelling_corrections: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "entities": dict(self.entities),
            "spans": [s.to_dict() for s in self.spans],
            "missing_for_booking": list(self.missing_for_booking),
            "processing_ms": round(self.processing_ms, 3),
            "normalized_message": self.normalized_message,
            "language": self.language,
            "error": self.error.to_dict() if self.error else None,
            "original_message": self.original_message,
            "synonym_resolutions": list(self.synonym_resolutions),
            "abbreviation_expansions": list(self.abbreviation_expansions),
            "spelling_corrections": list(self.spelling_corrections),
        }
