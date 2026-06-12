"""
Trend Analysis Utility
───────────────────────
Simulates sensor time-series trend data and computes:
  - Health score per equipment (0-100)
  - Trend direction and rate
  - Time-to-threshold predictions
  - Plant-wide health overview

In production: replace simulated history with real SCADA/historian data.
"""

import math
import random
from datetime import datetime, timedelta
from typing import Optional

from data.knowledge_base import SENSOR_READINGS, EQUIPMENT_REGISTRY, ACTIVE_ALERTS


def _simulate_trend_history(
    current_value: float,
    normal_range: list,
    status: str,
    trend: Optional[str],
    hours: int = 24,
    points: int = 24,
) -> list[dict]:
    """
    Simulate sensor history for the past `hours` hours with `points` data points.
    Generates realistic trends based on current status and trend direction.
    """
    lo, hi = normal_range
    history = []
    now = datetime.now()

    for i in range(points, 0, -1):
        timestamp = now - timedelta(hours=(i / points) * hours)
        progress = 1 - (i / points)   # 0 at start, 1 at now

        if trend == "rising" and status == "warning":
            # Was normal, drifted upward
            start_val = current_value - (progress * (current_value - (lo + (hi - lo) * 0.5)))
            val = start_val + random.gauss(0, (hi - lo) * 0.02)
        elif trend == "falling":
            start_val = current_value + (progress * ((hi - lo) * 0.3))
            val = start_val + random.gauss(0, (hi - lo) * 0.02)
        else:
            # Stable: vary around midpoint
            mid = (lo + hi) / 2
            val = current_value + random.gauss(0, (hi - lo) * 0.03)

        val = round(max(lo * 0.85, min(hi * 1.15, val)), 2)
        history.append({
            "timestamp": timestamp.isoformat(),
            "value": val,
            "label": timestamp.strftime("%H:%M"),
        })

    # Ensure last point is exactly current value
    history[-1]["value"] = current_value
    return history


def get_sensor_trends(equipment_id: str) -> dict:
    """
    Return trend history for all sensors on a piece of equipment.
    Also computes time-to-threshold for warning/critical sensors.
    """
    sensors = SENSOR_READINGS.get(equipment_id, {})
    result = {}

    for param, reading in sensors.items():
        history = _simulate_trend_history(
            current_value=reading["value"],
            normal_range=reading["normal_range"],
            status=reading.get("status", "normal"),
            trend=reading.get("trend"),
        )

        # Compute trend rate (change per hour over last 6 points)
        last_6 = [h["value"] for h in history[-6:]]
        if len(last_6) >= 2:
            trend_rate = (last_6[-1] - last_6[0]) / 6   # per hour
        else:
            trend_rate = 0.0

        # Time to threshold prediction
        time_to_threshold = None
        hi = reading["normal_range"][1]
        lo = reading["normal_range"][0]
        if trend_rate > 0 and reading["value"] < hi:
            hours_to_hi = (hi - reading["value"]) / trend_rate
            if hours_to_hi < 48:
                time_to_threshold = {
                    "threshold": hi,
                    "direction": "upper",
                    "hours": round(hours_to_hi, 1),
                    "label": f"~{hours_to_hi:.1f}h to upper limit",
                }
        elif trend_rate < 0 and reading["value"] > lo:
            hours_to_lo = (reading["value"] - lo) / abs(trend_rate)
            if hours_to_lo < 48:
                time_to_threshold = {
                    "threshold": lo,
                    "direction": "lower",
                    "hours": round(hours_to_lo, 1),
                    "label": f"~{hours_to_lo:.1f}h to lower limit",
                }

        result[param] = {
            "current": reading["value"],
            "unit": reading["unit"],
            "normal_range": reading["normal_range"],
            "status": reading.get("status", "normal"),
            "trend_direction": reading.get("trend", "stable"),
            "trend_rate_per_hour": round(trend_rate, 3),
            "history": history,
            "time_to_threshold": time_to_threshold,
        }

    return result


def compute_equipment_health_score(equipment_id: str) -> dict:
    """
    Compute a 0-100 health score for equipment based on:
    - Sensor status (warnings/criticals)
    - Active unacknowledged alerts
    - Trend directions
    - Days since last maintenance
    """
    from data.knowledge_base import get_history, MAINTENANCE_HISTORY

    sensors = SENSOR_READINGS.get(equipment_id, {})
    alerts = [a for a in ACTIVE_ALERTS if a["equipment_id"] == equipment_id]
    equip = next((e for e in EQUIPMENT_REGISTRY if e["id"] == equipment_id), {})

    # Base score: 100
    score = 100.0
    deductions = []

    # Sensor deductions
    for param, reading in sensors.items():
        if reading.get("status") == "critical":
            score -= 25
            deductions.append(f"{param}: critical status (-25)")
        elif reading.get("status") == "warning":
            score -= 10
            deductions.append(f"{param}: warning status (-10)")
        if reading.get("trend") == "rising" and reading.get("status") == "warning":
            score -= 5
            deductions.append(f"{param}: rising trend (-5)")

    # Alert deductions
    unack_alerts = [a for a in alerts if not a["acknowledged"]]
    for alert in unack_alerts:
        if alert["severity"] == "high":
            score -= 15
            deductions.append(f"Unacknowledged high alert: {alert['id']} (-15)")
        elif alert["severity"] == "medium":
            score -= 8
            deductions.append(f"Unacknowledged medium alert: {alert['id']} (-8)")

    # Days since last maintenance
    last_maint = equip.get("last_maintenance")
    if last_maint:
        try:
            days_since = (datetime.now() - datetime.fromisoformat(last_maint)).days
            if days_since > 90:
                penalty = min(15, (days_since - 90) // 10)
                score -= penalty
                deductions.append(f"{days_since} days since last maintenance (-{penalty})")
        except Exception:
            pass

    score = max(0, min(100, score))

    # Determine grade
    if score >= 85:
        grade, color = "Good", "#22c55e"
    elif score >= 65:
        grade, color = "Fair", "#f59e0b"
    elif score >= 40:
        grade, color = "Poor", "#f97316"
    else:
        grade, color = "Critical", "#ef4444"

    return {
        "equipment_id": equipment_id,
        "health_score": round(score, 1),
        "grade": grade,
        "color": color,
        "deductions": deductions,
        "sensor_warning_count": sum(1 for s in sensors.values() if s.get("status") == "warning"),
        "sensor_critical_count": sum(1 for s in sensors.values() if s.get("status") == "critical"),
        "unack_alert_count": len(unack_alerts),
    }


def get_plant_health_overview() -> dict:
    """Plant-wide health summary across all equipment."""
    scores = [compute_equipment_health_score(e["id"]) for e in EQUIPMENT_REGISTRY]
    avg_score = sum(s["health_score"] for s in scores) / len(scores) if scores else 0

    return {
        "plant_health_score": round(avg_score, 1),
        "equipment_scores": scores,
        "critical_count":  sum(1 for s in scores if s["grade"] == "Critical"),
        "poor_count":      sum(1 for s in scores if s["grade"] == "Poor"),
        "fair_count":      sum(1 for s in scores if s["grade"] == "Fair"),
        "good_count":      sum(1 for s in scores if s["grade"] == "Good"),
        "most_critical":   min(scores, key=lambda s: s["health_score"])["equipment_id"] if scores else None,
    }
