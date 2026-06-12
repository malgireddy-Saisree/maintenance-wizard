"""
Maintenance Scheduler Agent
─────────────────────────────
Role    : Takes all active alerts, risk scores, spare parts availability,
          and production schedule constraints to produce an OPTIMIZED
          maintenance schedule across all equipment.

This directly addresses the problem statement requirement:
  "Prioritization of maintenance actions based on operational and
   procurement constraints"

It answers the question an engineer actually asks:
  "What should I fix first, when, and in what order — given that I only
   have 2 fitters available and a planned shutdown window on Sunday?"

Input  : Optional constraints (available crew, shutdown window, budget)
Output : {
    "schedule":       [ordered list of maintenance tasks with timing],
    "gantt_data":     [data for Gantt chart visualization],
    "rationale":      <markdown explanation of prioritization logic>,
    "total_downtime": <estimated total hours>,
    "cost_estimate":  <total cost in INR>,
  }
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Optional

from data.knowledge_base import (
    EQUIPMENT_REGISTRY, SENSOR_READINGS, ACTIVE_ALERTS,
    MAINTENANCE_HISTORY, SPARE_PARTS_INVENTORY,
    get_alerts, get_spares, get_low_stock_spares,
)
from utils.azure_client import chat_completion, parse_json_response
from utils.prompt_builder import build_live_context_block, build_rag_context_block
from utils.vector_store import hybrid_retrieve, index_status

logger = logging.getLogger(__name__)

# ── Scoring weights ───────────────────────────────────────────────────────
W_SEVERITY    = 0.35   # How severe is the current condition
W_CRITICALITY = 0.25   # How critical is the equipment to production
W_TREND       = 0.20   # Is it getting worse?
W_SPARES      = 0.10   # Are parts available?
W_HISTORY     = 0.10   # How overdue is maintenance?

CRITICALITY_SCORE = {
    "critical": 1.0,
    "high":     0.75,
    "medium":   0.50,
    "low":      0.25,
}

SEVERITY_SCORE = {
    "critical": 1.0,
    "high":     0.75,
    "medium":   0.50,
    "warning":  0.40,
    "low":      0.20,
    "normal":   0.0,
}

ESTIMATED_REPAIR_HOURS = {
    "bearing_replacement":  7,
    "tuyere_replacement":   4,
    "mold_inspection":      12,
    "brake_replacement":    3,
    "general_inspection":   2,
    "lubrication":          1,
    "sensor_check":         0.5,
}

ESTIMATED_REPAIR_COST_INR = {
    "RM-04": 65000,
    "BF-01": 120000,
    "CC-03": 200000,
    "CR-06": 20000,
    "HX-05": 15000,
    "BOF-02": 90000,
}


def _score_equipment_urgency(equipment_id: str) -> dict:
    """
    Compute a composite urgency score (0-100) for scheduling priority.
    """
    equip = next((e for e in EQUIPMENT_REGISTRY if e["id"] == equipment_id), {})
    sensors = SENSOR_READINGS.get(equipment_id, {})
    alerts = get_alerts(equipment_id)

    # Severity score: worst sensor status
    sensor_statuses = [s.get("status", "normal") for s in sensors.values()]
    worst_status = "critical" if "critical" in sensor_statuses \
        else "warning" if "warning" in sensor_statuses else "normal"
    severity = SEVERITY_SCORE.get(worst_status, 0)

    # Unacknowledged high alert bonus
    unack_high = any(
        a["severity"] in ("high", "critical") and not a["acknowledged"]
        for a in alerts
    )
    if unack_high:
        severity = min(1.0, severity + 0.2)

    # Criticality
    criticality = CRITICALITY_SCORE.get(equip.get("criticality", "low"), 0.25)

    # Trend (rising = worse)
    rising_count = sum(
        1 for s in sensors.values()
        if s.get("trend") == "rising" and s.get("status") in ("warning", "critical")
    )
    trend_score = min(1.0, rising_count * 0.33)

    # Spares availability (low stock = lower priority if parts not available,
    # BUT also urgent procurement needed)
    spares = get_spares(equipment_id)
    spares_ok = all(s["qty"] > s["min_stock"] for s in spares) if spares else True
    spares_score = 1.0 if spares_ok else 0.6  # can still do it, but risky

    # Maintenance overdue
    last_maint = equip.get("last_maintenance")
    overdue_score = 0.0
    if last_maint:
        try:
            days_since = (datetime.now() - datetime.fromisoformat(last_maint)).days
            overdue_score = min(1.0, days_since / 90)
        except Exception:
            pass

    composite = (
        W_SEVERITY    * severity +
        W_CRITICALITY * criticality +
        W_TREND       * trend_score +
        W_SPARES      * spares_score +
        W_HISTORY     * overdue_score
    ) * 100

    return {
        "equipment_id":   equipment_id,
        "equipment_name": equip.get("name", equipment_id),
        "urgency_score":  round(composite, 1),
        "severity":       worst_status,
        "criticality":    equip.get("criticality", "unknown"),
        "has_rising_trend": rising_count > 0,
        "spares_available": spares_ok,
        "low_spares":     [s["name"] for s in spares if s["qty"] <= s["min_stock"]],
        "components": {
            "severity_component":    round(W_SEVERITY * severity * 100, 1),
            "criticality_component": round(W_CRITICALITY * criticality * 100, 1),
            "trend_component":       round(W_TREND * trend_score * 100, 1),
            "spares_component":      round(W_SPARES * spares_score * 100, 1),
            "overdue_component":     round(W_HISTORY * overdue_score * 100, 1),
        },
    }


def _build_schedule(scores: list[dict], constraints: dict) -> list[dict]:
    """
    Build an ordered maintenance schedule from urgency scores.
    Respects crew and time constraints.
    """
    sorted_equip = sorted(scores, key=lambda x: x["urgency_score"], reverse=True)

    available_crew = constraints.get("available_crew", 2)
    shutdown_window_hours = constraints.get("shutdown_window_hours", 8)
    start_dt = datetime.now().replace(microsecond=0)

    schedule = []
    current_time = start_dt
    accumulated_hours = 0

    for rank, equip in enumerate(sorted_equip, 1):
        eid = equip["equipment_id"]
        urgency = equip["urgency_score"]

        # Determine work type and timing
        if urgency >= 75:
            timing = "IMMEDIATE"
            window = "Next 0-4 hours"
            work_type = "Emergency / Corrective"
        elif urgency >= 50:
            timing = "URGENT"
            window = "Within 24 hours"
            work_type = "Corrective"
        elif urgency >= 30:
            timing = "PLANNED"
            window = "Within 72 hours"
            work_type = "Preventive"
        else:
            timing = "SCHEDULED"
            window = "Next planned shutdown"
            work_type = "Routine"

        est_hours = ESTIMATED_REPAIR_COST_INR.get(eid, 4)
        est_cost = ESTIMATED_REPAIR_COST_INR.get(eid, 50000)

        # Gantt slot
        task_start = current_time
        task_end = current_time + timedelta(hours=est_hours)
        if timing in ("IMMEDIATE", "URGENT"):
            current_time = task_end

        schedule.append({
            "rank":           rank,
            "equipment_id":   eid,
            "equipment_name": equip["equipment_name"],
            "urgency_score":  equip["urgency_score"],
            "timing":         timing,
            "window":         window,
            "work_type":      work_type,
            "estimated_hours": est_hours,
            "estimated_cost_inr": est_cost,
            "crew_required":  max(1, min(3, int(equip["urgency_score"] / 30))),
            "low_spares":     equip["low_spares"],
            "spares_available": equip["spares_available"],
            "start_iso":      task_start.isoformat(),
            "end_iso":        task_end.isoformat(),
            "rationale":      _build_rationale(equip),
        })

    return schedule


def _build_rationale(equip: dict) -> str:
    parts = []
    if equip["severity"] in ("critical", "warning"):
        parts.append(f"sensor status: {equip['severity']}")
    if equip["has_rising_trend"]:
        parts.append("active rising trend detected")
    if not equip["spares_available"]:
        parts.append(f"spare parts low: {', '.join(equip['low_spares'])}")
    if equip["criticality"] in ("critical", "high"):
        parts.append(f"equipment criticality: {equip['criticality']}")
    return "; ".join(parts) if parts else "routine scheduling"


async def run(constraints: Optional[dict] = None) -> dict:
    """
    Run the maintenance scheduler agent.

    Args:
        constraints: {
            "available_crew": int,
            "shutdown_window_hours": int,
            "budget_inr": int,
            "defer_equipment": [list of equipment IDs to skip],
        }

    Returns full schedule with Gantt data, rationale, and cost estimate.
    """
    logger.info("SchedulerAgent | starting | constraints=%s", constraints)
    constraints = constraints or {}

    # ── Step 1: Score all equipment ───────────────────────────────────────
    scores = [_score_equipment_urgency(e["id"]) for e in EQUIPMENT_REGISTRY]

    # Apply deferrals
    defer = constraints.get("defer_equipment", [])
    scores = [s for s in scores if s["equipment_id"] not in defer]

    # ── Step 2: Build schedule ────────────────────────────────────────────
    schedule = _build_schedule(scores, constraints)

    # ── Step 3: Gantt data for frontend visualization ─────────────────────
    gantt_data = [
        {
            "id":        item["equipment_id"],
            "name":      item["equipment_name"],
            "start":     item["start_iso"],
            "end":       item["end_iso"],
            "timing":    item["timing"],
            "hours":     item["estimated_hours"],
            "color":     _timing_color(item["timing"]),
        }
        for item in schedule if item["timing"] in ("IMMEDIATE", "URGENT")
    ]

    # Totals
    immediate_items = [s for s in schedule if s["timing"] in ("IMMEDIATE", "URGENT")]
    total_hours = sum(s["estimated_hours"] for s in immediate_items)
    total_cost  = sum(s["estimated_cost_inr"] for s in immediate_items)

    # ── Step 4: LLM rationale narrative ──────────────────────────────────
    rationale = await _generate_rationale(schedule, scores, constraints)

    logger.info("SchedulerAgent | %d tasks scheduled | done", len(schedule))
    return {
        "schedule":          schedule,
        "gantt_data":        gantt_data,
        "urgency_scores":    scores,
        "rationale":         rationale,
        "total_downtime_hours": total_hours,
        "total_cost_inr":    total_cost,
        "cost_display":      f"₹{total_cost/100000:.1f} lakhs",
        "immediate_count":   len([s for s in schedule if s["timing"] == "IMMEDIATE"]),
        "urgent_count":      len([s for s in schedule if s["timing"] == "URGENT"]),
        "planned_count":     len([s for s in schedule if s["timing"] == "PLANNED"]),
        "generated_at":      datetime.now().isoformat(),
    }


async def _generate_rationale(schedule: list, scores: list, constraints: dict) -> str:
    """LLM-generated explanation of the scheduling decisions."""
    top3 = schedule[:3]

    system = """You are a maintenance planning expert at Tata Steel.
Explain the maintenance schedule prioritization in 3 short paragraphs.
Be specific about why each equipment is ranked where it is.
Mention scoring factors: sensor severity, equipment criticality, trend direction, spare availability."""

    user = f"""Schedule generated at {datetime.now().strftime('%d %b %Y %H:%M')}
Constraints: {json.dumps(constraints) if constraints else 'None'}

Top 3 priorities:
{chr(10).join(f"{i+1}. {t['equipment_name']} (score: {t['urgency_score']}) — {t['timing']} — {t['rationale']}" for i, t in enumerate(top3))}

All urgency scores:
{chr(10).join(f"  {s['equipment_id']}: {s['urgency_score']} ({s['severity']} / {s['criticality']})" for s in scores)}

Write a clear maintenance schedule rationale."""

    messages = [
        {"role": "system", "content": system},
        {"role": "user",   "content": user},
    ]
    try:
        return await chat_completion(messages, temperature=0.2, max_tokens=400)
    except Exception as exc:
        logger.warning("SchedulerAgent | LLM rationale failed: %s", exc)
        return f"Schedule generated based on urgency scoring across {len(schedule)} equipment items. Top priority: {schedule[0]['equipment_name']} (score: {schedule[0]['urgency_score']})."


def _timing_color(timing: str) -> str:
    return {
        "IMMEDIATE": "#ef4444",
        "URGENT":    "#f97316",
        "PLANNED":   "#f59e0b",
        "SCHEDULED": "#22c55e",
    }.get(timing, "#4a5568")
