"""RAG package — retrieval only; no fine-tuning."""
from app.services.ai.rag.retriever import education_ui, format_answer, retrieve

__all__ = ["retrieve", "format_answer", "education_ui"]
