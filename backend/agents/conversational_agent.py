"""
Conversational Agent
─────────────────────
Role    : Multi-turn natural language maintenance expert.
          Maintains conversation context across turns.
          Routes to RAG retrieval for every user message, then
          responds with cited, grounded answers.
Input   : User message + conversation history + optional equipment focus
Output  : Markdown assistant response + retrieved sources
RAG     : Hybrid retrieval on every turn (query-specific)
Fallback: If index is not built, responds using live data only.
"""

import logging
from typing import Optional

from data.knowledge_base import (
    ACTIVE_ALERTS,
    EQUIPMENT_REGISTRY,
    SPARE_PARTS_INVENTORY,
    get_sensors,
    get_spares,
    get_low_stock_spares,
)
from utils.azure_client import chat_completion
from utils.prompt_builder import CONVERSATIONAL_SYSTEM, build_live_context_block, build_rag_context_block
from utils.vector_store import hybrid_retrieve, index_status, ScoredChunk

logger = logging.getLogger(__name__)

# Maximum conversation turns kept in context (each turn = user + assistant message)
MAX_HISTORY_TURNS = 6


async def run(
    user_message: str,
    conversation_history: Optional[list[dict]] = None,
    equipment_id: Optional[str] = None,
) -> dict:
    """
    Run one turn of the conversational agent.

    Args:
        user_message         : The latest user message
        conversation_history : List of {"role": "user"|"assistant", "content": str}
        equipment_id         : Optional equipment focus for retrieval boosting

    Returns:
        {
            "response":         <markdown string>,
            "sources":          [list of retrieved chunk dicts],
            "index_was_used":   bool,
        }
    """
    logger.info("ConversationalAgent | equip=%s | msg=%s", equipment_id, user_message[:80])

    history = conversation_history or []
    idx_status = index_status()
    sources: list[ScoredChunk] = []

    # ── Step 1: RAG retrieval (if index is available) ─────────────────────
    if idx_status["built"]:
        chunks: list[ScoredChunk] = await hybrid_retrieve(
            user_message,
            top_k=5,
            equipment_id=equipment_id,
        )
        sources = chunks
        rag_block = build_rag_context_block([c.to_dict() for c in chunks])
    else:
        logger.warning("ConversationalAgent | index not built — using live data fallback")
        rag_block = (
            "⚠ Knowledge index not built yet. "
            "Go to the RAG Index page and click 'Build Index' to enable source-grounded answers."
        )

    # ── Step 2: Live context (compact — only what fits efficiently) ────────
    live_block = build_live_context_block(
        equipment=None,
        sensors=get_sensors(equipment_id) if equipment_id else None,
        alerts=ACTIVE_ALERTS,
        history=None,
        spares=get_low_stock_spares(),
    )

    # Compact equipment summary so we don't blow the context window
    equip_summary = ", ".join(
        f"{e['id']}: {e['name']} ({e['criticality']})"
        for e in EQUIPMENT_REGISTRY
    )

    # ── Step 3: Build messages ────────────────────────────────────────────
    system_content = (
        f"{CONVERSATIONAL_SYSTEM}"
        f"{f'Current equipment focus: {equipment_id}' if equipment_id else ''}\n\n"
        f"── RETRIEVED KNOWLEDGE (RAG) ───────────────────────────────────\n"
        f"{rag_block}\n"
        f"───────────────────────────────────────────────────────────────\n\n"
        f"── LIVE PLANT DATA ─────────────────────────────────────────────\n"
        f"Equipment: {equip_summary}\n\n"
        f"{live_block}\n"
        f"───────────────────────────────────────────────────────────────"
    )

    messages = [{"role": "system", "content": system_content}]

    # Trim history to last MAX_HISTORY_TURNS turns (2 messages per turn)
    trimmed_history = history[-(MAX_HISTORY_TURNS * 2):]
    messages.extend(trimmed_history)
    messages.append({"role": "user", "content": user_message})

    # ── Step 4: Call LLM ──────────────────────────────────────────────────
    response = await chat_completion(messages, temperature=0.2, max_tokens=1300)

    logger.info("ConversationalAgent | sources=%d | index_used=%s | done",
                len(sources), idx_status["built"])
    return {
        "response": response,
        "sources": [c.to_dict() for c in sources],
        "index_was_used": idx_status["built"],
    }
