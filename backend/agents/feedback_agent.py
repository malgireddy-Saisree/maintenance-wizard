"""
Feedback Loop Agent
────────────────────
Role    : Accept engineer feedback on AI responses (correct / incorrect / partial),
          store feedback records, and use accumulated feedback to improve
          future agent prompts dynamically.

This implements a lightweight RLHF-style feedback mechanism:
  - Engineers rate responses: 👍 correct | 👎 incorrect | ✏ partial
  - Corrections are stored in memory (production: persist to DB)
  - On next agent call, relevant past feedback is injected as few-shot examples
  - Feedback summary is exposed via API for monitoring

Input  : Response ID, rating, optional correction text
Output : Acknowledgement + updated feedback store summary
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Optional

from utils.azure_client import chat_completion

logger = logging.getLogger(__name__)

# ── In-memory feedback store (production: use Azure Cosmos DB / PostgreSQL) ──

_feedback_store: list[dict] = []
_correction_examples: list[dict] = []   # distilled few-shot examples


def get_feedback_summary() -> dict:
    """Return aggregated feedback statistics."""
    if not _feedback_store:
        return {
            "total_feedback": 0,
            "correct": 0,
            "incorrect": 0,
            "partial": 0,
            "correction_examples": 0,
        }
    ratings = [f["rating"] for f in _feedback_store]
    return {
        "total_feedback": len(_feedback_store),
        "correct":   ratings.count("correct"),
        "incorrect": ratings.count("incorrect"),
        "partial":   ratings.count("partial"),
        "correction_examples": len(_correction_examples),
        "recent": _feedback_store[-5:],
    }


def get_correction_examples(limit: int = 3) -> list[dict]:
    """Return most recent correction examples for few-shot injection."""
    return _correction_examples[-limit:]


async def record_feedback(
    agent_name: str,
    original_query: str,
    original_response: str,
    rating: str,                          # "correct" | "incorrect" | "partial"
    engineer_correction: Optional[str] = None,
    equipment_id: Optional[str] = None,
) -> dict:
    """
    Record engineer feedback and optionally distil a correction example.

    Returns:
        {
            "feedback_id": str,
            "acknowledged": bool,
            "distilled": bool,       # True if correction was distilled to few-shot
            "summary": dict,
        }
    """
    if rating not in ("correct", "incorrect", "partial"):
        raise ValueError("rating must be 'correct', 'incorrect', or 'partial'")

    feedback_id = f"FB-{uuid.uuid4().hex[:8].upper()}"
    timestamp = datetime.now().isoformat()

    record = {
        "feedback_id": feedback_id,
        "timestamp": timestamp,
        "agent": agent_name,
        "equipment_id": equipment_id,
        "query": original_query[:500],
        "response_preview": original_response[:300],
        "rating": rating,
        "correction": engineer_correction,
    }
    _feedback_store.append(record)
    logger.info("FeedbackAgent | id=%s | agent=%s | rating=%s", feedback_id, agent_name, rating)

    distilled = False

    # ── Distil correction into a few-shot example ─────────────────────────
    if rating in ("incorrect", "partial") and engineer_correction:
        distilled_example = await _distil_correction(
            agent_name, original_query, original_response, engineer_correction, equipment_id
        )
        if distilled_example:
            _correction_examples.append(distilled_example)
            distilled = True
            logger.info("FeedbackAgent | distilled correction example #%d", len(_correction_examples))

    return {
        "feedback_id": feedback_id,
        "acknowledged": True,
        "distilled": distilled,
        "summary": get_feedback_summary(),
    }


async def _distil_correction(
    agent_name: str,
    query: str,
    bad_response: str,
    correction: str,
    equipment_id: Optional[str],
) -> Optional[dict]:
    """
    Use GPT-4o to distil the engineer correction into a clean few-shot example.
    Returns None on failure.
    """
    system_prompt = """You are a technical editor for an industrial AI system.
Given a query, a flawed AI response, and an engineer's correction,
extract a clean, generalizable few-shot example.

Return ONLY valid JSON:
{
  "context": "<brief description of the situation>",
  "query_pattern": "<generalised query pattern>",
  "correct_approach": "<what the AI should do in this situation>",
  "key_facts": ["fact1", "fact2"],
  "avoid": "<what the AI incorrectly did>"
}"""

    user_msg = f"""Agent: {agent_name}
Equipment: {equipment_id or 'General'}
Original query: {query[:300]}
Flawed response (first 300 chars): {bad_response[:300]}
Engineer correction: {correction[:500]}

Distil into a few-shot example."""

    try:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg},
        ]
        raw = await chat_completion(messages, temperature=0.1, max_tokens=400, response_format="json")
        example = json.loads(raw.replace("```json", "").replace("```", "").strip())
        example["agent"] = agent_name
        example["timestamp"] = datetime.now().isoformat()
        return example
    except Exception as exc:
        logger.warning("FeedbackAgent | distil failed: %s", exc)
        return None


def build_feedback_injection(agent_name: str) -> str:
    """
    Build a few-shot feedback block to inject into agent system prompts.
    Only includes corrections relevant to this agent.
    """
    relevant = [
        ex for ex in _correction_examples
        if ex.get("agent") == agent_name
    ][-3:]   # last 3 relevant corrections

    if not relevant:
        return ""

    lines = ["\n── ENGINEER FEEDBACK (learned corrections) ─────────────────────"]
    for ex in relevant:
        lines.append(
            f"Situation: {ex.get('context', '')}\n"
            f"Correct approach: {ex.get('correct_approach', '')}\n"
            f"Key facts: {', '.join(ex.get('key_facts', []))}\n"
            f"Avoid: {ex.get('avoid', '')}"
        )
    lines.append("────────────────────────────────────────────────────────────────\n")
    return "\n".join(lines)
