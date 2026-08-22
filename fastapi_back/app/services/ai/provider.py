"""Shared async LLM provider for grounded MEDCLUES assistants.

The provider never receives credentials from clients and never executes tools.
Gateway/services remain responsible for authorization, data minimization, and safety.
"""
from __future__ import annotations

import asyncio
import json
import re
import time
from dataclasses import dataclass
from typing import Any

from app.config.config import settings
from app.utils.app_logger import get_logger

log = get_logger(__name__)


@dataclass(frozen=True)
class LLMResult:
    success: bool
    content: str = ""
    model: str = ""
    latency_ms: float = 0
    error: str | None = None
    usage: dict[str, Any] | None = None


def is_configured() -> bool:
    name = provider_name()
    if name == "openai":
        return bool((getattr(settings, "OPENAI_API_KEY", None) or "").strip())
    if name == "cohere":
        return bool((getattr(settings, "COHERE_API_KEY", None) or "").strip())
    if name in {"qwen", "dashscope"}:
        return bool((getattr(settings, "DASHSCOPE_API_KEY", None) or "").strip())
    return bool((getattr(settings, "MISTRAL_API_KEY", None) or "").strip())


def is_enabled() -> bool:
    return bool(getattr(settings, "AI_LLM_ENABLED", False)) and is_configured()


def provider_name() -> str:
    name = str(getattr(settings, "AI_LLM_PROVIDER", "mistral") or "mistral").lower()
    if name in {"qwen", "dashscope", "alibaba"}:
        return "qwen"
    return name if name in {"mistral", "openai", "qwen", "cohere"} else "mistral"


def _openai_compatible_base_url() -> str:
    configured = (getattr(settings, "AI_LLM_BASE_URL", None) or "").strip().rstrip("/")
    if configured:
        return configured
    if provider_name() == "qwen":
        # International DashScope OpenAI-compatible endpoint (India / non-CN)
        return "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    if provider_name() == "cohere":
        return "https://api.cohere.com/compatibility/v1"
    return "https://api.openai.com/v1"


def _openai_compatible_api_key() -> str:
    if provider_name() == "qwen":
        return (getattr(settings, "DASHSCOPE_API_KEY", None) or "").strip()
    if provider_name() == "cohere":
        return (getattr(settings, "COHERE_API_KEY", None) or "").strip()
    return (getattr(settings, "OPENAI_API_KEY", None) or "").strip()


def _model() -> str:
    configured = str(getattr(settings, "AI_LLM_MODEL", "") or "").strip()
    name = provider_name()
    if name == "openai":
        if not configured or configured.startswith("mistral-") or configured.startswith("qwen"):
            return "gpt-4.1-mini"
        return configured
    if name == "qwen":
        if not configured or configured.startswith("mistral-") or configured.startswith("gpt-"):
            return "qwen-plus"
        return configured
    if name == "cohere":
        if (
            not configured
            or configured.startswith("mistral-")
            or configured.startswith("gpt-")
            or configured.startswith("qwen")
        ):
            return "command-r-plus"
        return configured
    return configured or "mistral-medium-latest"


def model_name() -> str:
    return _model()


def _content(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        parts = []
        for item in value:
            if isinstance(item, dict):
                parts.append(str(item.get("text") or item.get("content") or ""))
            else:
                parts.append(str(getattr(item, "text", item)))
        return "".join(parts).strip()
    return str(value or "").strip()


def _sync_mistral_complete(
    messages: list[dict[str, str]],
    *,
    temperature: float,
    max_tokens: int,
) -> tuple[str, dict[str, Any]]:
    from mistralai.client import Mistral

    client = Mistral(api_key=settings.MISTRAL_API_KEY)
    response = client.chat.complete(
        model=_model(),
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    content = _content(response.choices[0].message.content if response.choices else "")
    raw_usage = getattr(response, "usage", None)
    usage = {
        "promptTokens": getattr(raw_usage, "prompt_tokens", None),
        "completionTokens": getattr(raw_usage, "completion_tokens", None),
        "totalTokens": getattr(raw_usage, "total_tokens", None),
    }
    return content, usage


def _sync_openai_complete(
    messages: list[dict[str, str]],
    *,
    temperature: float,
    max_tokens: int,
) -> tuple[str, dict[str, Any]]:
    import httpx

    base = _openai_compatible_base_url()
    api_key = _openai_compatible_api_key()
    response = httpx.post(
        f"{base}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": _model(),
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
        timeout=22.0,
    )
    response.raise_for_status()
    payload = response.json()
    choices = payload.get("choices") or []
    content = _content((choices[0].get("message") or {}).get("content") if choices else "")
    raw_usage = payload.get("usage") or {}
    usage = {
        "promptTokens": raw_usage.get("prompt_tokens"),
        "completionTokens": raw_usage.get("completion_tokens"),
        "totalTokens": raw_usage.get("total_tokens"),
    }
    return content, usage


def _cohere_message_text(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                if item.get("type") in {None, "text"}:
                    parts.append(str(item.get("text") or item.get("content") or ""))
            else:
                parts.append(str(getattr(item, "text", item) or ""))
        return "".join(parts).strip()
    return str(content or "").strip()


def _sync_cohere_complete(
    messages: list[dict[str, str]],
    *,
    temperature: float,
    max_tokens: int,
) -> tuple[str, dict[str, Any]]:
    """Cohere Chat API v2 (preferred). Falls back to OpenAI-compatible URL when configured."""
    import httpx

    configured = (getattr(settings, "AI_LLM_BASE_URL", None) or "").strip().rstrip("/")
    if configured and "compatibility" in configured.lower():
        return _sync_openai_complete(
            messages, temperature=temperature, max_tokens=max_tokens
        )

    api_key = (getattr(settings, "COHERE_API_KEY", None) or "").strip()
    response = httpx.post(
        "https://api.cohere.com/v2/chat",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json={
            "model": _model(),
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
        timeout=22.0,
    )
    response.raise_for_status()
    payload = response.json()
    message = payload.get("message") or {}
    content = _cohere_message_text(message.get("content"))
    raw_usage = payload.get("usage") or {}
    billed = raw_usage.get("billed_units") or {}
    tokens = raw_usage.get("tokens") or {}
    usage = {
        "promptTokens": tokens.get("input_tokens") or billed.get("input_tokens"),
        "completionTokens": tokens.get("output_tokens") or billed.get("output_tokens"),
        "totalTokens": None,
    }
    if usage["promptTokens"] is not None and usage["completionTokens"] is not None:
        usage["totalTokens"] = int(usage["promptTokens"]) + int(usage["completionTokens"])
    return content, usage


async def complete(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.25,
    max_tokens: int = 700,
    timeout_seconds: float = 25.0,
) -> LLMResult:
    if not is_configured():
        return LLMResult(success=False, error="not_configured")

    safe_messages = []
    for message in messages[-14:]:
        role = str(message.get("role") or "user")
        if role not in {"system", "user", "assistant"}:
            role = "user"
        safe_messages.append(
            {"role": role, "content": str(message.get("content") or "")[:6000]}
        )

    started = time.perf_counter()
    last_error = "provider_error"
    for attempt in range(2):
        try:
            name = provider_name()
            if name == "cohere":
                sync_complete = _sync_cohere_complete
            elif name in {"openai", "qwen"}:
                sync_complete = _sync_openai_complete
            else:
                sync_complete = _sync_mistral_complete
            content, usage = await asyncio.wait_for(
                asyncio.to_thread(
                    sync_complete,
                    safe_messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                ),
                timeout=timeout_seconds,
            )
            if not content:
                raise ValueError("empty_response")
            return LLMResult(
                success=True,
                content=content,
                model=_model(),
                latency_ms=(time.perf_counter() - started) * 1000,
                usage=usage,
            )
        except Exception as exc:
            last_error = type(exc).__name__
            detail = ""
            try:
                resp = getattr(exc, "response", None)
                if resp is not None:
                    detail = f" {resp.status_code}:{(resp.text or '')[:180]}"
            except Exception:
                pass
            if attempt == 0:
                log.warning("%s attempt failed: %s%s", provider_name(), last_error, detail)
                await asyncio.sleep(0.25)

    log.warning("%s provider failed: %s", provider_name(), last_error)
    return LLMResult(
        success=False,
        model=_model(),
        latency_ms=(time.perf_counter() - started) * 1000,
        error=last_error,
    )


async def complete_text(
    *,
    system_prompt: str,
    user_message: str,
    history: list[dict[str, Any]] | None = None,
    grounding: str = "",
) -> LLMResult:
    messages: list[dict[str, str]] = [
        {"role": "system", "content": system_prompt[:6000]}
    ]
    for turn in (history or [])[-8:]:
        role = "assistant" if turn.get("role") == "assistant" else "user"
        text = str(turn.get("text") or turn.get("content") or "").strip()
        if text:
            messages.append({"role": role, "content": text[:800]})
    if grounding:
        messages.append(
            {
                "role": "system",
                "content": (
                    "Use only this trusted MEDCLUES context for factual claims. "
                    "If it is insufficient, say so.\n" + grounding[:6000]
                ),
            }
        )
    messages.append({"role": "user", "content": user_message[:2000]})
    return await complete(messages)


async def complete_json(
    *,
    system_prompt: str,
    user_message: str,
    fallback: dict[str, Any] | None = None,
) -> dict[str, Any]:
    result = await complete(
        [
            {
                "role": "system",
                "content": system_prompt
                + "\nReturn one valid JSON object only; no Markdown or explanation.",
            },
            {"role": "user", "content": user_message[:2000]},
        ],
        temperature=0.05,
        max_tokens=450,
    )
    if not result.success:
        return dict(fallback or {})

    text = result.content.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    return dict(fallback or {})
