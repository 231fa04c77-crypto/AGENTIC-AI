"""Compatibility wrappers around the shared async Mistral provider."""
from app.services.ai import provider

async def generate_chat_completion(user_message, conversation_history=None, system_prompt='', model='mistral-medium-latest'):
    result = await provider.complete_text(
        system_prompt=system_prompt or "You are a concise MEDCLUES assistant.",
        user_message=str(user_message or ""),
        history=conversation_history or [],
    )
    if not result.success:
        return "I'm temporarily unable to reach the AI service. Please try again in a moment."
    return result.content or ""

async def generate_structured_response(prompt, model='mistral-medium-latest'):
    return await provider.complete_json(
        system_prompt="Convert the request into the requested structured response.",
        user_message=str(prompt or ""),
        fallback={},
    )
