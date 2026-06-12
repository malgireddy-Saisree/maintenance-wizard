"""
Recommendation Agent
─────────────────────
Role    : Given a diagnosis, generate step-by-step maintenance recommendations
          grounded in SOPs, spare parts inventory, and technical bulletins.
Input   : Diagnosis text + equipment ID
Output  : Structured markdown action plan with SOP references and spares check
RAG     : Retrieves SOPs and maintenance bulletins relevant to the diagnosis
"""

import logging
from typing import Optional

from data.knowledge_base import get_equipment, get_alerts, get_spares
from utils.azure_client import chat_completion
from utils.prompt_builder import (
    RECOMMENDATION_SYSTEM,
    build_live_context_block,
    build_rag_context_block,
)
from utils.vector_store import hybrid_retrieve, ScoredChunk

logger = logging.getLogger(__name__)


async def run(
    diagnosis: str,
    equipment_id: Optional[str] = None,
) -> dict:
    """
    Run the recommendation agent.

    Returns:
        {
            "response": <markdown string>,
            "sources":  [list of retrieved chunk dicts],
        }
    """
    logger.info("RecommendationAgent | equip=%s", equipment_id)

    # ── Step 1: RAG retrieval (SOPs and bulletins preferred) ──────────────
    rag_query = f"repair procedure step by step maintenance SOP {equipment_id} {diagnosis[:200]}"
    chunks: list[ScoredChunk] = await hybrid_retrieve(
        rag_query,
        top_k=5,
        equipment_id=equipment_id,
    )
    rag_block = build_rag_context_block([c.to_dict() for c in chunks])

    # ── Step 2: Live data (spares + alerts are critical here) ─────────────
    live_block = build_live_context_block(
        equipment=get_equipment(equipment_id),
        sensors=None,
        alerts=get_alerts(equipment_id),
        history=None,
        spares=get_spares(equipment_id),
    )

    # ── Step 3: Build messages ────────────────────────────────────────────
    system_content = (
        f"{RECOMMENDATION_SYSTEM}\n\n"
        f"── RETRIEVED SOPs AND PROCEDURES (RAG) ────────────────────────\n"
        f"{rag_block}\n"
        f"───────────────────────────────────────────────────────────────\n\n"
        f"── LIVE CONTEXT ────────────────────────────────────────────────\n"
        f"{live_block}\n"
        f"───────────────────────────────────────────────────────────────"
    )

    user_content = (
        f"Based on the following diagnosis, generate maintenance recommendations"
        f"{f' for equipment {equipment_id}' if equipment_id else ''}:\n\n{diagnosis}"
    )

    messages = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content},
    ]

    # ── Step 4: Call LLM ──────────────────────────────────────────────────
    response = await chat_completion(messages, temperature=0.2, max_tokens=1600)

    logger.info("RecommendationAgent | sources=%d | done", len(chunks))
    return {
        "response": response,
        "sources": [c.to_dict() for c in chunks],
    }
