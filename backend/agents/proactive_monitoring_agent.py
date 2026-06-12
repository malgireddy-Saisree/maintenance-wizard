"""
Proactive Monitoring Agent
───────────────────────────
Role    : Runs autonomously on a schedule (or on-demand trigger) to scan
          ALL equipment sensor readings, detect early-warning patterns,
          compute risk trajectories, and generate unprompted alerts.

This is the key "agentic" behaviour — the system acts WITHOUT being asked.
It combines:
  1. Rule-based early warning (fast, no API cost)
  2. Cross-equipment correlation detection (e.g. BF-01 tuyere heat
     correlating with CC-03 cooling water — same cooling circuit)
  3. LLM synthesis of a plant-wide situation report
  4. Priority-ranked action list for the shift engineer

Input  : None (reads live plant data directly)
Output : {
    "alerts":           [list of early warnings],
    "correlations":     [list of cross-equipment patterns],
    "situation_report": <markdown summary>,
    "priority_actions": [ranked action items],
    "business_impact":  {estimated_downtime_risk, estimated_cost_risk}
  }
"""

import logging
from datetime import datetime
from typing import Optional

from data.knowledge_base import (
    SENSOR_READINGS, EQUIPMENT_REGISTRY, ACTIVE_ALERTS,
    SPARE_PARTS_INVENTORY, MAINTENANCE_HISTORY,
    get_low_stock_spares,
)
from utils.azure_client import chat_completion
from utils.prompt_builder import build_rag_context_block
from utils.vector_store import hybrid_retrieve, index_status

logger = logging.getLogger(__name__)

# ── Business impact constants (Tata Steel scale) ──────────────────────────
HOURLY_PRODUCTION_VALUE_INR = 2_500_000   # ₹25 lakhs per hour of production
EQUIPMENT_DOWNTIME_COST = {
    "BF-01":  8_000_000,   # ₹80 lakhs/hr (blast furnace — whole plant impact)
    "BOF-02": 5_000_000,
    "CC-03":  4_000_000,
    "RM-04":  3_500_000,
    "HX-05":  1_500_000,
    "CR-06":  2_000_000,
}


def _early_warning_rules() -> list[dict]:
    """
    Fast rule-based early warning detection.
    Runs in microseconds — no API call needed.
    Detects patterns that are NOT yet at alarm level but trending there.
    """
    warnings = []

    for equip_id, sensors in SENSOR_READINGS.items():
        equip = next((e for e in EQUIPMENT_REGISTRY if e["id"] == equip_id), {})

        for param, reading in sensors.items():
            val = reading["value"]
            lo, hi = reading["normal_range"]
            status = reading.get("status", "normal")
            trend = reading.get("trend", "stable")

            # Pattern 1: Value in upper 15% of normal range AND rising
            upper_15pct = lo + (hi - lo) * 0.85
            if status == "normal" and val > upper_15pct and trend == "rising":
                warnings.append({
                    "equipment_id":   equip_id,
                    "equipment_name": equip.get("name", equip_id),
                    "parameter":      param,
                    "type":           "EARLY_WARNING",
                    "severity":       "medium",
                    "value":          val,
                    "unit":           reading["unit"],
                    "normal_range":   reading["normal_range"],
                    "message":        (
                        f"{param.replace('_',' ').title()} at {val} {reading['unit']} "
                        f"— in upper 15% of normal range and rising. "
                        f"Not yet alarming but trajectory requires monitoring."
                    ),
                    "hours_to_threshold": round((hi - val) / max(0.1, (val - upper_15pct) / 2), 1),
                    "proactive": True,
                })

            # Pattern 2: Warning status with rising trend = accelerating degradation
            if status == "warning" and trend == "rising":
                rate_estimate = (val - lo) / (hi - lo)  # normalized degradation
                warnings.append({
                    "equipment_id":   equip_id,
                    "equipment_name": equip.get("name", equip_id),
                    "parameter":      param,
                    "type":           "ACCELERATING_DEGRADATION",
                    "severity":       "high",
                    "value":          val,
                    "unit":           reading["unit"],
                    "normal_range":   reading["normal_range"],
                    "message":        (
                        f"ACCELERATING: {param.replace('_',' ').title()} "
                        f"at {val} {reading['unit']} — warning status AND rising trend "
                        f"indicates active degradation process."
                    ),
                    "degradation_pct": round(rate_estimate * 100, 1),
                    "proactive": True,
                })

    return warnings


def _detect_cross_equipment_correlations() -> list[dict]:
    """
    Detect patterns that span multiple pieces of equipment.
    In a steel plant, equipment share cooling systems, power circuits,
    and process streams — failures cascade.
    """
    correlations = []

    # Pattern: Multiple warnings in same zone = shared system issue
    zone_warnings = {}
    for equip in EQUIPMENT_REGISTRY:
        zone = equip.get("location", "").split(" - ")[0]
        sensors = SENSOR_READINGS.get(equip["id"], {})
        warning_count = sum(1 for s in sensors.values() if s.get("status") in ("warning", "critical"))
        if warning_count > 0:
            zone_warnings.setdefault(zone, []).append({
                "equipment_id": equip["id"],
                "name": equip["name"],
                "warnings": warning_count,
            })

    for zone, equips in zone_warnings.items():
        if len(equips) >= 2:
            correlations.append({
                "type": "ZONE_PATTERN",
                "zone": zone,
                "equipment": equips,
                "message": (
                    f"Multiple equipment in {zone} showing anomalies simultaneously: "
                    f"{', '.join(e['name'] for e in equips)}. "
                    f"Possible shared utility (cooling water, power, compressed air) issue."
                ),
                "severity": "high",
            })

    # Pattern: RM-04 bearing temp + motor current both warning = compound failure risk
    rm04 = SENSOR_READINGS.get("RM-04", {})
    if (rm04.get("bearing_temp", {}).get("status") == "warning" and
            rm04.get("motor_current", {}).get("status") == "warning"):
        correlations.append({
            "type": "COMPOUND_FAILURE_RISK",
            "equipment_id": "RM-04",
            "message": (
                "RM-04 bearing temperature AND motor current both in warning simultaneously. "
                "Based on failure analysis FAR-2026-RM04-001, this dual-parameter pattern "
                "preceded catastrophic bearing failure by 3 hours. Immediate intervention required."
            ),
            "severity": "critical",
            "historical_precedent": "FAR-2026-RM04-001 (May 2026)",
        })

    # Pattern: Low spare stock + active warning on same equipment = procurement risk
    low_stock = get_low_stock_spares()
    for spare in low_stock:
        for equip_id in spare.get("equipments", []):
            sensors = SENSOR_READINGS.get(equip_id, {})
            has_warning = any(s.get("status") in ("warning", "critical") for s in sensors.values())
            if has_warning:
                correlations.append({
                    "type": "PROCUREMENT_RISK",
                    "equipment_id": equip_id,
                    "spare": spare["name"],
                    "stock": spare["qty"],
                    "min_stock": spare["min_stock"],
                    "lead_time": spare["lead_time"],
                    "message": (
                        f"{equip_id} has active sensor warning AND its critical spare "
                        f"'{spare['name']}' is at minimum stock ({spare['qty']} units, "
                        f"min: {spare['min_stock']}). Lead time: {spare['lead_time']}. "
                        f"If failure occurs, replacement parts may not be available."
                    ),
                    "severity": "critical",
                })

    return correlations


def _compute_business_impact(warnings: list, correlations: list) -> dict:
    """Estimate financial and operational impact of detected risks."""
    # Find highest-risk equipment
    critical_equip = set()
    for w in warnings:
        if w.get("severity") == "high":
            critical_equip.add(w["equipment_id"])
    for c in correlations:
        if c.get("severity") == "critical" and "equipment_id" in c:
            critical_equip.add(c["equipment_id"])

    total_hourly_risk = sum(
        EQUIPMENT_DOWNTIME_COST.get(eid, 2_000_000)
        for eid in critical_equip
    )

    # Estimate probability-weighted cost (30% chance of failure in 24h if unaddressed)
    failure_probability = 0.30 if critical_equip else 0.05
    expected_downtime_hours = 6   # average corrective maintenance duration
    expected_cost_inr = total_hourly_risk * expected_downtime_hours * failure_probability

    return {
        "at_risk_equipment":         list(critical_equip),
        "failure_probability_24h":   f"{int(failure_probability * 100)}%",
        "expected_downtime_hours":   expected_downtime_hours,
        "max_hourly_cost_inr":       total_hourly_risk,
        "probability_weighted_cost": round(expected_cost_inr),
        "cost_display":              f"₹{expected_cost_inr/100000:.1f} lakhs",
        "intervention_saves":        f"₹{expected_cost_inr * 0.85 / 100000:.1f} lakhs",
    }


async def run(include_llm_report: bool = True) -> dict:
    """
    Run the full proactive monitoring cycle.

    Returns comprehensive plant status without any user prompt.
    This is the autonomous, scheduled behaviour.
    """
    logger.info("ProactiveMonitoringAgent | starting autonomous scan")

    # ── Step 1: Rule-based scans (always run, zero API cost) ──────────────
    early_warnings = _early_warning_rules()
    correlations = _detect_cross_equipment_correlations()
    business_impact = _compute_business_impact(early_warnings, correlations)

    # Priority action list (rule-based, fast)
    priority_actions = _build_priority_actions(early_warnings, correlations)

    result = {
        "scan_timestamp":  datetime.now().isoformat(),
        "early_warnings":  early_warnings,
        "correlations":    correlations,
        "priority_actions": priority_actions,
        "business_impact": business_impact,
        "situation_report": None,
        "total_warnings":  len(early_warnings),
        "critical_count":  sum(1 for w in early_warnings if w.get("severity") == "high"),
    }

    # ── Step 2: LLM situation report (optional, costs tokens) ─────────────
    if include_llm_report:
        try:
            report = await _generate_situation_report(
                early_warnings, correlations, priority_actions, business_impact
            )
            result["situation_report"] = report
        except Exception as exc:
            logger.warning("ProactiveMonitoringAgent | LLM report failed: %s", exc)
            result["situation_report"] = _fallback_report(early_warnings, correlations)

    logger.info(
        "ProactiveMonitoringAgent | done | warnings=%d correlations=%d",
        len(early_warnings), len(correlations)
    )
    return result


def _build_priority_actions(warnings: list, correlations: list) -> list[dict]:
    """Build a ranked list of actions sorted by urgency and business impact."""
    actions = []
    priority = 1

    # Critical correlations first
    for c in correlations:
        if c.get("severity") == "critical":
            actions.append({
                "priority": priority,
                "action_type": c["type"],
                "equipment_id": c.get("equipment_id", "Multiple"),
                "action": c["message"],
                "urgency": "IMMEDIATE",
                "estimated_time": "0-2 hours",
            })
            priority += 1

    # High severity early warnings
    for w in warnings:
        if w.get("severity") == "high":
            actions.append({
                "priority": priority,
                "action_type": "SENSOR_RESPONSE",
                "equipment_id": w["equipment_id"],
                "action": f"Investigate {w['parameter']} on {w['equipment_name']}: {w['message']}",
                "urgency": "WITHIN 4 HOURS",
                "estimated_time": "1-3 hours",
            })
            priority += 1

    # Medium warnings
    for w in warnings:
        if w.get("severity") == "medium":
            actions.append({
                "priority": priority,
                "action_type": "PREVENTIVE_CHECK",
                "equipment_id": w["equipment_id"],
                "action": f"Monitor {w['parameter']} on {w['equipment_name']}: {w['message']}",
                "urgency": "WITHIN 24 HOURS",
                "estimated_time": "30 min check",
            })
            priority += 1

    return actions[:10]  # Top 10 only


async def _generate_situation_report(
    warnings: list, correlations: list, actions: list, impact: dict
) -> str:
    """Use LLM to generate a coherent plant-wide situation narrative."""

    # Optionally retrieve relevant docs if index is built
    rag_block = ""
    if index_status()["built"]:
        try:
            chunks = await hybrid_retrieve(
                "equipment failure prediction risk assessment bearing temperature",
                top_k=3,
            )
            if chunks:
                rag_block = (
                    "\nRelevant knowledge:\n" +
                    "\n".join(f"- {c.chunk.title}: {c.chunk.content[:200]}" for c in chunks)
                )
        except Exception:
            pass

    system = """You are an autonomous AI monitoring system for Tata Steel Jamshedpur plant.
Generate a concise shift-engineer situation report based on current sensor data.
Be direct and action-oriented. Use bullet points. Maximum 300 words."""

    user = f"""Current plant status — {datetime.now().strftime('%d %b %Y %H:%M')}:

Early warnings detected: {len(warnings)}
Cross-equipment correlations: {len(correlations)}
At-risk equipment: {', '.join(impact.get('at_risk_equipment', [])) or 'None'}
Estimated financial exposure: {impact.get('cost_display', 'N/A')}

Key patterns:
{chr(10).join(f"- {w['message']}" for w in warnings[:5])}

Correlations:
{chr(10).join(f"- {c['message']}" for c in correlations[:3])}

Priority actions:
{chr(10).join(f"{a['priority']}. [{a['urgency']}] {a['action'][:100]}" for a in actions[:5])}
{rag_block}

Generate a 3-paragraph situation report: (1) Current status, (2) Key risks, (3) Recommended actions."""

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    return await chat_completion(messages, temperature=0.2, max_tokens=500)


def _fallback_report(warnings: list, correlations: list) -> str:
    """Fallback report if LLM call fails."""
    lines = [f"## Plant Status — {datetime.now().strftime('%d %b %Y %H:%M')}\n"]
    if not warnings and not correlations:
        lines.append("All equipment operating within normal parameters. No proactive alerts.")
    else:
        lines.append(f"**{len(warnings)} early warning(s) detected** requiring attention.\n")
        for w in warnings[:5]:
            lines.append(f"- **{w['equipment_id']}**: {w['message']}")
        if correlations:
            lines.append(f"\n**{len(correlations)} cross-equipment correlation(s):**")
            for c in correlations[:3]:
                lines.append(f"- {c['message']}")
    return "\n".join(lines)
