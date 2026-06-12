"""
Diagnostic Agent
────────────────
Role    : Analyse equipment symptoms, sensor readings, and maintenance history
          to produce a structured fault diagnosis and root cause assessment.
Input   : Natural language query + equipment context
Output  : Structured markdown diagnosis with source citations
RAG     : Hybrid retrieval from manuals and failure reports
"""

import logging
from typing import Optional

from data.knowledge_base import get_equipment, get_sensors, get_alerts, get_history, get_spares
from utils.azure_client import chat_completion
from utils.prompt_builder import (
    DIAGNOSTIC_SYSTEM,
    build_live_context_block,
    build_rag_context_block,
)
from utils.vector_store import hybrid_retrieve, ScoredChunk

logger = logging.getLogger(__name__)


async def run(
    query: str,
    equipment_id: Optional[str] = None,
    conversation_history: Optional[list[dict]] = None,
) -> dict:
    """
    Run the diagnostic agent.

    Returns:
        {
            "response": <markdown string>,
            "sources":  [list of retrieved chunk dicts],
        }
    """
    logger.info("DiagnosticAgent | equip=%s | query=%s", equipment_id, query[:80])

    # ── Step 1: RAG retrieval ─────────────────────────────────────────────
    rag_query = f"diagnosis fault root cause {query}"
    chunks: list[ScoredChunk] = await hybrid_retrieve(
        rag_query,
        top_k=5,
        equipment_id=equipment_id,
    )
    rag_block = build_rag_context_block([c.to_dict() for c in chunks])

    # ── Step 2: Live data ─────────────────────────────────────────────────
    live_block = build_live_context_block(
        equipment=get_equipment(equipment_id),
        sensors=get_sensors(equipment_id),
        alerts=get_alerts(equipment_id),
        history=get_history(equipment_id, limit=4),
        spares=get_spares(equipment_id),
    )

    # ── Step 3: Build messages ────────────────────────────────────────────
    system_content = (
        f"{DIAGNOSTIC_SYSTEM}\n\n"
        f"── RETRIEVED DOCUMENTS (RAG) ──────────────────────────────────\n"
        f"{rag_block}\n"
        f"───────────────────────────────────────────────────────────────\n\n"
        f"── LIVE EQUIPMENT DATA ─────────────────────────────────────────\n"
        f"{live_block}\n"
        f"───────────────────────────────────────────────────────────────"
    )

    messages = [{"role": "system", "content": system_content}]
    if conversation_history:
        messages.extend(conversation_history[-6:])
    messages.append({"role": "user", "content": query})

    # ── Step 4: Call LLM ──────────────────────────────────────────────────
    response = await chat_completion(messages, temperature=0.2, max_tokens=1400)

    logger.info("DiagnosticAgent | sources=%d | done", len(chunks))
    return {
        "response": response,
        "sources": [c.to_dict() for c in chunks],
    }
