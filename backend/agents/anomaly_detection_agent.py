"""
Anomaly Detection Agent
────────────────────────
Role    : Sweep all equipment sensor readings, identify parameters outside
          normal ranges, classify severity, and return structured alerts.
Input   : All sensor readings (plant-wide)
Output  : JSON array of detected anomalies
RAG     : Not used — this agent works entirely on structured sensor data
          and calls the LLM only for natural-language alert generation.
"""

import json
import logging

from data.knowledge_base import SENSOR_READINGS, EQUIPMENT_REGISTRY, ACTIVE_ALERTS
from utils.azure_client import chat_completion, parse_json_response
from utils.prompt_builder import ANOMALY_DETECTION_SYSTEM

logger = logging.getLogger(__name__)


def _rule_based_anomalies() -> list[dict]:
    """
    Fast rule-based anomaly detection — runs first, before any LLM call.
    Returns anomalies derived purely from sensor status fields.
    """
    anomalies = []
    for equip_id, sensors in SENSOR_READINGS.items():
        equip_name = next(
            (e["name"] for e in EQUIPMENT_REGISTRY if e["id"] == equip_id), equip_id
        )
        for param, reading in sensors.items():
            if reading.get("status") in ("warning", "critical"):
                value = reading["value"]
                lo, hi = reading["normal_range"]
                deviation_pct = max(
                    abs(value - hi) / hi * 100 if value > hi else 0,
                    abs(lo - value) / lo * 100 if value < lo else 0,
                )
                anomalies.append({
                    "equipment_id": equip_id,
                    "equipment_name": equip_name,
                    "parameter": param,
                    "severity": reading["status"],   # "warning" or "critical"
                    "current_value": value,
                    "normal_range": reading["normal_range"],
                    "unit": reading["unit"],
                    "trend": reading.get("trend", "stable"),
                    "deviation_pct": round(deviation_pct, 1),
                    "message": (
                        f"{param.replace('_', ' ').title()} on {equip_name} is "
                        f"{value} {reading['unit']} "
                        f"({'above' if value > hi else 'below'} normal range "
                        f"{lo}–{hi} {reading['unit']})"
                    ),
                    "recommended_action": _default_action(equip_id, param, reading),
                })
    return anomalies


def _default_action(equip_id: str, param: str, reading: dict) -> str:
    """Simple rule-based default action before LLM enrichment."""
    if "temp" in param and reading.get("trend") == "rising":
        return "Inspect cooling system and lubrication. Check for blockages."
    if "wear" in param:
        return "Schedule replacement at next planned shutdown."
    if "current" in param:
        return "Inspect mechanical load and electrical supply."
    if "flow" in param:
        return "Inspect for blockages or pump degradation."
    return "Investigate and report to shift engineer."


async def run(use_llm_enrichment: bool = True) -> dict:
    """
    Run the anomaly detection agent.

    Returns:
        {
            "anomalies": [list of anomaly dicts],
            "rule_based_count": int,
            "total_sensors_scanned": int,
        }
    """
    logger.info("AnomalyDetectionAgent | scanning %d equipment", len(SENSOR_READINGS))

    # ── Step 1: Rule-based pass (always runs, no API cost) ────────────────
    rule_anomalies = _rule_based_anomalies()
    total_sensors = sum(len(s) for s in SENSOR_READINGS.values())

    if not use_llm_enrichment or not rule_anomalies:
        return {
            "anomalies": rule_anomalies,
            "rule_based_count": len(rule_anomalies),
            "total_sensors_scanned": total_sensors,
        }

    # ── Step 2: LLM enrichment — add context-aware messages ──────────────
    # Only pass anomalous readings to save tokens
    anomalous_sensors = {
        eid: {
            param: data
            for param, data in sensors.items()
            if data.get("status") in ("warning", "critical")
        }
        for eid, sensors in SENSOR_READINGS.items()
        if any(d.get("status") in ("warning", "critical") for d in sensors.values())
    }

    messages = [
        {"role": "system", "content": ANOMALY_DETECTION_SYSTEM},
        {
            "role": "user",
            "content": (
                f"Anomalous sensor readings:\n{json.dumps(anomalous_sensors, indent=2)}\n\n"
                f"Existing alerts (for context, do not duplicate):\n"
                f"{json.dumps(ACTIVE_ALERTS, indent=2)}"
            ),
        },
    ]

    try:
        raw = await chat_completion(messages, temperature=0.1, max_tokens=800, response_format="json")
        llm_anomalies = parse_json_response(raw)
        if isinstance(llm_anomalies, list) and llm_anomalies:
            # Merge LLM-enriched messages back into rule-based results
            llm_map = {(a.get("equipment_id"), a.get("parameter")): a for a in llm_anomalies}
            for anomaly in rule_anomalies:
                key = (anomaly["equipment_id"], anomaly["parameter"])
                if key in llm_map:
                    anomaly["message"] = llm_map[key].get("message", anomaly["message"])
                    anomaly["recommended_action"] = llm_map[key].get(
                        "recommended_action", anomaly["recommended_action"]
                    )
    except Exception as exc:
        logger.warning("AnomalyDetectionAgent | LLM enrichment failed: %s — using rule-based only", exc)

    logger.info("AnomalyDetectionAgent | %d anomalies found", len(rule_anomalies))
    return {
        "anomalies": rule_anomalies,
        "rule_based_count": len(rule_anomalies),
        "total_sensors_scanned": total_sensors,
    }
