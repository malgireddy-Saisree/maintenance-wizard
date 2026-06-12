"""
Risk Scoring Agent
───────────────────
Role    : Compute a structured risk score for a piece of equipment using
          sensor readings, alert history, maintenance records, and
          retrieved RUL / predictive maintenance bulletins.
Input   : Equipment ID
Output  : JSON risk assessment (risk score, RUL, failure probability, trend …)
RAG     : Retrieves RUL formulas and risk threshold documents
"""

import logging
from typing import Optional

from data.knowledge_base import get_equipment, get_sensors, get_alerts, get_history
from utils.azure_client import chat_completion, parse_json_response
from utils.prompt_builder import RISK_SCORING_SYSTEM, build_live_context_block, build_rag_context_block
from utils.vector_store import hybrid_retrieve, ScoredChunk

logger = logging.getLogger(__name__)

_FALLBACK = {
    "overall_risk": "Unknown",
    "risk_score": 50,
    "rul": "Unable to compute — check Azure OpenAI configuration",
    "failure_probability": 50,
    "critical_factors": ["Assessment failed"],
    "trend": "Stable",
    "next_maintenance_window": "Consult engineer",
    "production_impact_if_failed": "Unknown",
    "diagnosis": "Risk assessment could not be completed.",
    "immediate_actions": [],
    "sources_used": [],
}


async def run(equipment_id: str) -> dict:
    """
    Run the risk scoring agent for a single equipment.

    Returns:
        JSON dict matching the schema defined in RISK_SCORING_SYSTEM.
        Always returns a valid dict (uses _FALLBACK on parse failure).
    """
    logger.info("RiskScoringAgent | equip=%s", equipment_id)

    # ── Step 1: RAG retrieval (RUL and threshold bulletins) ───────────────
    rag_query = f"risk assessment remaining useful life failure prediction threshold {equipment_id}"
    chunks: list[ScoredChunk] = await hybrid_retrieve(
        rag_query,
        top_k=4,
        equipment_id=equipment_id,
    )
    rag_block = build_rag_context_block([c.to_dict() for c in chunks])

    # ── Step 2: Live data ─────────────────────────────────────────────────
    live_block = build_live_context_block(
        equipment=get_equipment(equipment_id),
        sensors=get_sensors(equipment_id),
        alerts=get_alerts(equipment_id),
        history=get_history(equipment_id, limit=3),
        spares=None,
    )

    # ── Step 3: Build messages ────────────────────────────────────────────
    system_content = (
        f"{RISK_SCORING_SYSTEM}\n\n"
        f"── RETRIEVED RISK / RUL DOCUMENTS (RAG) ───────────────────────\n"
        f"{rag_block}\n"
        f"───────────────────────────────────────────────────────────────\n\n"
        f"── LIVE EQUIPMENT DATA ─────────────────────────────────────────\n"
        f"{live_block}\n"
        f"───────────────────────────────────────────────────────────────"
    )

    messages = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": f"Compute the risk assessment JSON for equipment {equipment_id}."},
    ]

    # ── Step 4: Call LLM (JSON mode, low temperature for determinism) ─────
    raw = await chat_completion(
        messages,
        temperature=0.1,
        max_tokens=600,
        response_format="json",
    )

    # ── Step 5: Parse and validate ────────────────────────────────────────
    try:
        result = parse_json_response(raw)
        result["sources_used"] = [c.chunk.title for c in chunks]
        logger.info("RiskScoringAgent | risk=%s | score=%s | done",
                    result.get("overall_risk"), result.get("risk_score"))
        return result
    except Exception as exc:
        logger.error("RiskScoringAgent | JSON parse failed: %s", exc)
        return _FALLBACK
