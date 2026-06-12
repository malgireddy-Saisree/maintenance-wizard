"""
Shared Azure OpenAI client.
All agents import from here — one place to manage auth, retries, and logging.
"""

import json
import logging
from typing import Any

from openai import AsyncAzureOpenAI

from config import get_settings

logger = logging.getLogger(__name__)


def get_client() -> AsyncAzureOpenAI:
    s = get_settings()
    return AsyncAzureOpenAI(
        azure_endpoint=s.azure_openai_endpoint,
        api_key=s.azure_openai_api_key,
        api_version=s.azure_api_version,
    )


async def chat_completion(
    messages: list[dict],
    temperature: float = 0.2,
    max_tokens: int = 1500,
    response_format: str = "text",   # "text" | "json"
) -> str:
    s = get_settings()
    client = get_client()

    kwargs: dict[str, Any] = {
        "model": s.azure_chat_deployment,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if response_format == "json":
        kwargs["response_format"] = {"type": "json_object"}

    logger.debug("chat_completion | tokens=%d | temp=%.1f", max_tokens, temperature)
    response = await client.chat.completions.create(**kwargs)
    content = response.choices[0].message.content or ""
    logger.debug("chat_completion | output_tokens=%d", response.usage.completion_tokens)
    return content


async def get_embedding(text: str) -> list[float]:
    s = get_settings()
    client = get_client()

    response = await client.embeddings.create(
        model=s.azure_embedding_deployment,
        input=text[:8000],   # safety truncation
    )
    return response.data[0].embedding


def parse_json_response(raw: str) -> dict | list:
    """Strip markdown fences and parse JSON safely."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        cleaned = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
    return json.loads(cleaned)
