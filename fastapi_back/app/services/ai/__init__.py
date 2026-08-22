"""Enterprise AI Medical Assistant package (extractable microservice boundary)."""
from app.services.ai.gateway import assistant_chat, is_enabled, list_tools_for_role
from app.services.ai.constants import DISCLAIMER

__all__ = ["assistant_chat", "is_enabled", "list_tools_for_role", "DISCLAIMER"]
