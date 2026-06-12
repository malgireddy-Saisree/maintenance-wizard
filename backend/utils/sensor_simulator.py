"""
Sensor Simulator
─────────────────
Background asyncio task that simulates live sensor degradation.
RM-04 bearing temperature rises ~0.5°C every 60 seconds (mimicking 2°C/hr).
When thresholds are crossed, new alerts are automatically generated.
WebSocket clients are notified in real-time.

This makes the demo feel truly live — dashboard changes, AI gives
different answers when asked twice, browser notifications fire.
"""

import asyncio
import logging
import random
from datetime import datetime
from typing import Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)

# Connected WebSocket clients
_ws_clients: Set[WebSocket] = set()

# Track which alerts we've already generated to avoid duplicates
_generated_alert_ids: Set[str] = set()


def register_ws(ws: WebSocket):
    _ws_clients.add(ws)
    logger.info("SensorSimulator | WS client connected | total=%d", len(_ws_clients))


def unregister_ws(ws: WebSocket):
    _ws_clients.discard(ws)
    logger.info("SensorSimulator | WS client disconnected | total=%d", len(_ws_clients))


async def _broadcast(payload: dict):
    """Push payload to all connected WebSocket clients."""
    import json
    dead = set()
    for ws in _ws_clients:
        try:
            await ws.send_text(json.dumps(payload))
        except Exception:
            dead.add(ws)
    for ws in dead:
        _ws_clients.discard(ws)


async def run_degradation_loop():
    """
    Runs forever in the background.
    Every 60 seconds:
      1. Increment RM-04 bearing_temp by 0.4-0.8°C
      2. Increment RM-04 motor_current by 1-3A
      3. Increment BF-01 tuyere_temp by 0.2-0.5°C
      4. Increment CR-06 brake_wear by 0.1-0.3%
      5. Cross threshold → add alert + browser push
      6. Push updated sensor snapshot to all WS clients
    """
    from data.knowledge_base import SENSOR_READINGS, ACTIVE_ALERTS

    logger.info("SensorSimulator | degradation loop started")

    while True:
        await asyncio.sleep(60)

        try:
            # ── RM-04 bearing temperature ─────────────────────────────────
            bt = SENSOR_READINGS["RM-04"]["bearing_temp"]
            delta = round(random.uniform(0.4, 0.8), 1)
            bt["value"] = round(bt["value"] + delta, 1)

            if bt["value"] >= 80 and bt["status"] != "critical":
                bt["status"] = "critical"
                _add_alert("ALT-SIM-001", "RM-04", "critical", "bearing_temp",
                            f"CRITICAL: Bearing temperature reached {bt['value']}°C — "
                            f"exceeds 80°C trip threshold. IMMEDIATE SHUTDOWN REQUIRED.",
                            ACTIVE_ALERTS)
                await _broadcast({
                    "type": "CRITICAL_ALERT",
                    "equipment_id": "RM-04",
                    "parameter": "bearing_temp",
                    "value": bt["value"],
                    "message": f"RM-04 bearing temperature CRITICAL: {bt['value']}°C",
                    "timestamp": datetime.now().isoformat(),
                })
            elif bt["value"] >= 75 and bt["status"] == "normal":
                bt["status"] = "warning"
                bt["trend"] = "rising"

            # ── RM-04 motor current ───────────────────────────────────────
            mc = SENSOR_READINGS["RM-04"]["motor_current"]
            mc["value"] = round(mc["value"] + random.uniform(1, 3), 0)
            if mc["value"] > 950:
                mc["status"] = "warning"
                mc["trend"] = "rising"

            # ── BF-01 tuyere temperature ──────────────────────────────────
            tt = SENSOR_READINGS["BF-01"]["tuyere_temp"]
            tt["value"] = round(tt["value"] + random.uniform(0.2, 0.5), 1)
            if tt["value"] >= 280 and tt["status"] != "critical":
                tt["status"] = "critical"
                _add_alert("ALT-SIM-002", "BF-01", "critical", "tuyere_temp",
                            f"CRITICAL: Tuyere temperature at {tt['value']}°C — "
                            f"burn-through risk. Reduce blast immediately per SOP-BF-006.",
                            ACTIVE_ALERTS)
                await _broadcast({
                    "type": "CRITICAL_ALERT",
                    "equipment_id": "BF-01",
                    "parameter": "tuyere_temp",
                    "value": tt["value"],
                    "message": f"BF-01 tuyere temperature CRITICAL: {tt['value']}°C",
                    "timestamp": datetime.now().isoformat(),
                })
            elif tt["value"] >= 265 and tt["status"] == "normal":
                tt["status"] = "warning"
                tt["trend"] = "rising"

            # ── CR-06 brake wear ──────────────────────────────────────────
            bw = SENSOR_READINGS["CR-06"]["brake_wear"]
            bw["value"] = round(bw["value"] + random.uniform(0.1, 0.3), 1)
            if bw["value"] >= 80 and bw["status"] != "critical":
                bw["status"] = "critical"
                _add_alert("ALT-SIM-003", "CR-06", "high", "brake_wear",
                            f"Crane #6 brake pad wear at {bw['value']}% — "
                            f"replacement threshold reached. Schedule immediately.",
                            ACTIVE_ALERTS)

            # ── Broadcast live sensor snapshot to all WS clients ──────────
            await _broadcast({
                "type": "SENSOR_UPDATE",
                "timestamp": datetime.now().isoformat(),
                "sensors": {
                    "RM-04": {
                        "bearing_temp": SENSOR_READINGS["RM-04"]["bearing_temp"],
                        "motor_current": SENSOR_READINGS["RM-04"]["motor_current"],
                    },
                    "BF-01": {
                        "tuyere_temp": SENSOR_READINGS["BF-01"]["tuyere_temp"],
                    },
                    "CR-06": {
                        "brake_wear": SENSOR_READINGS["CR-06"]["brake_wear"],
                    },
                },
            })

            logger.info(
                "SensorSimulator | tick | RM-04 bearing=%.1f°C motor=%dA | BF-01 tuyere=%.1f°C | CR-06 brake=%.1f%%",
                SENSOR_READINGS["RM-04"]["bearing_temp"]["value"],
                SENSOR_READINGS["RM-04"]["motor_current"]["value"],
                SENSOR_READINGS["BF-01"]["tuyere_temp"]["value"],
                SENSOR_READINGS["CR-06"]["brake_wear"]["value"],
            )

        except Exception as exc:
            logger.error("SensorSimulator | error in tick: %s", exc)


def _add_alert(alert_id: str, equip_id: str, severity: str,
               parameter: str, message: str, alert_list: list):
    """Add a new simulated alert if not already present."""
    if alert_id in _generated_alert_ids:
        return
    _generated_alert_ids.add(alert_id)
    alert_list.append({
        "id": alert_id,
        "equipment_id": equip_id,
        "severity": severity,
        "parameter": parameter,
        "message": message,
        "timestamp": datetime.now().isoformat(),
        "acknowledged": False,
        "simulated": True,
    })
    logger.warning("SensorSimulator | NEW ALERT: %s — %s", alert_id, message[:80])
