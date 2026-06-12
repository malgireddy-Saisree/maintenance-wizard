"""
Report Generation Agent
────────────────────────
Role    : Generate formal, downloadable maintenance reports in Markdown.
          Supports three report types: full assessment, daily shift handover,
          and spare parts procurement advisory.
Input   : Report type + equipment ID (for full assessment)
Output  : Markdown string + retrieved sources
RAG     : Retrieves relevant docs per report type
"""

import logging
from datetime import date
from typing import Optional

from data.knowledge_base import (
    ACTIVE_ALERTS,
    EQUIPMENT_REGISTRY,
    get_equipment,
    get_history,
    get_sensors,
    get_spares,
    get_low_stock_spares,
    SPARE_PARTS_INVENTORY,
)
from utils.azure_client import chat_completion
from utils.prompt_builder import (
    REPORT_SYSTEM,
    build_live_context_block,
    build_rag_context_block,
    build_report_instruction,
)
from utils.vector_store import hybrid_retrieve, ScoredChunk

logger = logging.getLogger(__name__)

VALID_REPORT_TYPES = ("full_assessment", "daily_shift", "procurement")

_RAG_QUERIES = {
    "full_assessment": "maintenance assessment failure analysis risk RUL",
    "daily_shift": "shift handover maintenance summary alerts actions",
    "procurement": "spare parts procurement inventory stock level lead time",
}


async def run(
    report_type: str,
    equipment_id: Optional[str] = "RM-04",
) -> dict:
    """
    Run the report generation agent.

    Args:
        report_type : one of "full_assessment" | "daily_shift" | "procurement"
        equipment_id: focus equipment (used for full_assessment)

    Returns:
        {
            "report":   <markdown string>,
            "sources":  [list of retrieved chunk dicts],
            "filename": <suggested download filename>,
        }
    """
    if report_type not in VALID_REPORT_TYPES:
        raise ValueError(f"Invalid report type. Choose from {VALID_REPORT_TYPES}.")

    logger.info("ReportAgent | type=%s | equip=%s", report_type, equipment_id)

    # ── Step 1: RAG retrieval ─────────────────────────────────────────────
    rag_equip = equipment_id if report_type == "full_assessment" else None
    rag_query = f"{_RAG_QUERIES[report_type]} {equipment_id or ''}"
    chunks: list[ScoredChunk] = await hybrid_retrieve(
        rag_query,
        top_k=5,
        equipment_id=rag_equip,
    )
    rag_block = build_rag_context_block([c.to_dict() for c in chunks])

    # ── Step 2: Assemble live data per report type ─────────────────────────
    today = date.today().strftime("%d %B %Y")
    equip_obj = get_equipment(equipment_id)[0] if equipment_id else None

    if report_type == "full_assessment":
        live_block = build_live_context_block(
            equipment=equip_obj,
            sensors=get_sensors(equipment_id),
            alerts=ACTIVE_ALERTS,
            history=get_history(equipment_id, limit=5),
            spares=get_spares(equipment_id),
        )
    elif report_type == "daily_shift":
        live_block = build_live_context_block(
            equipment=EQUIPMENT_REGISTRY,
            sensors=None,
            alerts=ACTIVE_ALERTS,
            history=get_history(limit=6),
            spares=get_low_stock_spares(),
        )
    else:  # procurement
        live_block = build_live_context_block(
            equipment=EQUIPMENT_REGISTRY,
            sensors=None,
            alerts=None,
            history=None,
            spares=SPARE_PARTS_INVENTORY,
        )

    # ── Step 3: Build messages ────────────────────────────────────────────
    report_instruction = build_report_instruction(
        report_type,
        equip_obj["name"] if equip_obj else "All Equipment",
        today,
    )

    system_content = (
        f"{REPORT_SYSTEM}\n\n"
        f"── RETRIEVED KNOWLEDGE (RAG) ───────────────────────────────────\n"
        f"{rag_block}\n"
        f"───────────────────────────────────────────────────────────────\n\n"
        f"── LIVE PLANT DATA ─────────────────────────────────────────────\n"
        f"{live_block}\n"
        f"───────────────────────────────────────────────────────────────"
    )

    messages = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": report_instruction},
    ]

    # ── Step 4: Call LLM ──────────────────────────────────────────────────
    report_md = await chat_completion(messages, temperature=0.3, max_tokens=2200)

    filename = f"tata-steel-{report_type.replace('_', '-')}-{date.today().isoformat()}.md"

    logger.info("ReportAgent | sources=%d | chars=%d | done", len(chunks), len(report_md))
    return {
        "report": report_md,
        "sources": [c.to_dict() for c in chunks],
        "filename": filename,
    }
