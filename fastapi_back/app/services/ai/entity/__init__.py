"""Module 2 — Entity Extraction (pure NLU entities, no business actions)."""
from app.services.ai.entity.compose import analyze_message
from app.services.ai.entity.detector import extract_entities
from app.services.ai.entity.schemas import EntityError, EntityResult, EntitySpan

__all__ = [
    "extract_entities",
    "analyze_message",
    "EntityResult",
    "EntitySpan",
    "EntityError",
]
