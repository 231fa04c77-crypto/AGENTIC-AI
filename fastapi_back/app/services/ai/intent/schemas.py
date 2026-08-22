"""Structured output for Module 1 Intent Engine."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class IntentError:
    code: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return {"code": self.code, "message": self.message}


@dataclass
class IntentHit:
    intent: str
    confidence: float
    strength: str = "keyword"  # exact | phrase | keyword | weak


@dataclass
class IntentResult:
    primary_intent: str
    secondary_intents: list[str] = field(default_factory=list)
    confidence: dict[str, float] = field(default_factory=dict)
    requires_clarification: bool = False
    message_type: str = "unknown"
    processing_ms: float = 0.0
    normalized_message: str = ""
    language: str = "en"
    error: Optional[IntentError] = None
    truncated: bool = False

    def to_dict(self) -> dict[str, Any]:
        out = {
            "primary_intent": self.primary_intent,
            "secondary_intents": list(self.secondary_intents),
            "confidence": dict(self.confidence),
            "requires_clarification": self.requires_clarification,
            "message_type": self.message_type,
            "processing_ms": round(self.processing_ms, 3),
            "normalized_message": self.normalized_message,
            "language": self.language,
            "error": self.error.to_dict() if self.error else None,
            "truncated": self.truncated,
        }
        return out

    def as_json_compatible(self) -> dict[str, Any]:
        return self.to_dict()
