"""Intent Dictionary schema — one intent definition."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class IntentPattern:
    strength: str  # exact | phrase | keyword | weak
    regex: str


@dataclass(frozen=True)
class IntentDefinition:
    id: str
    name: str
    description: str
    category: str
    priority: int
    confidence_threshold: float
    synonyms: tuple[str, ...] = ()
    aliases: tuple[str, ...] = ()
    examples: tuple[str, ...] = ()
    workflow: str = ""
    required_entities: tuple[str, ...] = ()
    tool: str = "none"
    requires_auth: bool = False
    requires_confirmation: bool = False
    supports_followup: bool = True
    emergency: bool = False
    fallback_intent: str = "unknown_intent"
    output_category: str = "information"
    message_type: str = "information"
    patterns: tuple[IntentPattern, ...] = ()
    synonyms_hi: tuple[str, ...] = ()
    examples_te: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["patterns"] = [{"strength": p.strength, "regex": p.regex} for p in self.patterns]
        return d


@dataclass
class IntentDictionary:
    version: int = 1
    description: str = ""
    intents: dict[str, IntentDefinition] = field(default_factory=dict)

    def get(self, intent_id: str) -> IntentDefinition | None:
        return self.intents.get(intent_id)

    def list_ids(self) -> list[str]:
        return list(self.intents.keys())

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "description": self.description,
            "intents": {k: v.to_dict() for k, v in self.intents.items()},
        }
