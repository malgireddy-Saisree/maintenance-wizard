"""
Router: /api/plant
Read-only endpoints exposing the plant knowledge base data.
In production these would query SCADA / ERP / CMMS systems.
"""

from fastapi import APIRouter, HTTPException

from data.knowledge_base import (
    ACTIVE_ALERTS,
    EQUIPMENT_REGISTRY,
    MAINTENANCE_HISTORY,
    SPARE_PARTS_INVENTORY,
    get_equipment,
    get_sensors,
    get_alerts,
    get_history,
    get_spares,
    get_low_stock_spares,
)

router = APIRouter(prefix="/api/plant", tags=["Plant Data"])


@router.get("/equipment")
async def list_equipment() -> dict:
    return {"equipment": EQUIPMENT_REGISTRY}


@router.get("/equipment/{equipment_id}")
async def get_equipment_detail(equipment_id: str) -> dict:
    equip = get_equipment(equipment_id)
    if not equip:
        raise HTTPException(status_code=404, detail=f"Equipment {equipment_id} not found.")
    return {
        "equipment": equip[0],
        "sensors": get_sensors(equipment_id).get(equipment_id, {}),
        "alerts": get_alerts(equipment_id),
        "history": get_history(equipment_id),
        "spares": get_spares(equipment_id),
    }


@router.get("/sensors")
async def all_sensors() -> dict:
    return {"sensors": get_sensors()}


@router.get("/sensors/{equipment_id}")
async def equipment_sensors(equipment_id: str) -> dict:
    data = get_sensors(equipment_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"No sensor data for {equipment_id}.")
    return {"equipment_id": equipment_id, "sensors": data[equipment_id]}


@router.get("/alerts")
async def all_alerts(unacknowledged_only: bool = False) -> dict:
    alerts = ACTIVE_ALERTS
    if unacknowledged_only:
        alerts = [a for a in alerts if not a["acknowledged"]]
    return {"alerts": alerts, "total": len(alerts)}


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str) -> dict:
    """Mark an alert as acknowledged (persists in-memory for the session)."""
    for alert in ACTIVE_ALERTS:
        if alert["id"] == alert_id:
            alert["acknowledged"] = True
            return {"success": True, "alert_id": alert_id}
    raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")



async def all_history(equipment_id: str | None = None, limit: int = 10) -> dict:
    return {"history": get_history(equipment_id, limit=limit)}


@router.get("/spares")
async def all_spares(low_stock_only: bool = False) -> dict:
    spares = get_low_stock_spares() if low_stock_only else SPARE_PARTS_INVENTORY
    return {"spares": spares, "total": len(spares)}


@router.get("/dashboard")
async def dashboard_summary() -> dict:
    """Aggregated summary for the frontend dashboard."""
    low_stock = get_low_stock_spares()
    unack_alerts = [a for a in ACTIVE_ALERTS if not a["acknowledged"]]
    recent_maintenance = get_history(limit=5)

    # Count equipment by risk level (based on alert severity)
    high_alert_equip = {a["equipment_id"] for a in unack_alerts if a["severity"] in ("high", "critical")}

    return {
        "total_equipment": len(EQUIPMENT_REGISTRY),
        "unacknowledged_alerts": len(unack_alerts),
        "high_risk_equipment": len(high_alert_equip),
        "low_stock_spares": len(low_stock),
        "recent_maintenance_count": len(MAINTENANCE_HISTORY),
        "equipment_status": [
            {
                "id": e["id"],
                "name": e["name"],
                "criticality": e["criticality"],
                "location": e["location"],
                "alert_count": len(get_alerts(e["id"])),
                "unack_alert_count": len([a for a in get_alerts(e["id"]) if not a["acknowledged"]]),
                "has_warning_sensor": any(
                    s.get("status") in ("warning", "critical")
                    for s in get_sensors(e["id"]).get(e["id"], {}).values()
                ),
            }
            for e in EQUIPMENT_REGISTRY
        ],
        "recent_maintenance": recent_maintenance,
        "low_stock_spares_list": low_stock,
    }


# ── Trend and health endpoints ────────────────────────────────────────────

from utils.trend_analysis import get_sensor_trends, compute_equipment_health_score, get_plant_health_overview


@router.get("/trends/{equipment_id}")
async def sensor_trends(equipment_id: str) -> dict:
    """Return 24h simulated sensor trend history + time-to-threshold predictions."""
    equip = get_equipment(equipment_id)
    if not equip:
        raise HTTPException(status_code=404, detail=f"Equipment {equipment_id} not found.")
    return {
        "equipment_id": equipment_id,
        "equipment_name": equip[0]["name"],
        "trends": get_sensor_trends(equipment_id),
    }


@router.get("/health/{equipment_id}")
async def equipment_health(equipment_id: str) -> dict:
    """Return computed health score for a single equipment."""
    equip = get_equipment(equipment_id)
    if not equip:
        raise HTTPException(status_code=404, detail=f"Equipment {equipment_id} not found.")
    return compute_equipment_health_score(equipment_id)


@router.get("/health")
async def plant_health() -> dict:
    """Return plant-wide health overview across all equipment."""
    return get_plant_health_overview()


# ── RUL endpoints ─────────────────────────────────────────────────────────

from utils.rul_calculator import compute_rul, get_plant_rul_summary

@router.get("/rul/{equipment_id}")
async def equipment_rul(equipment_id: str) -> dict:
    """Compute formula-based RUL for one equipment, grounded in AI4I 2020 data."""
    equip = get_equipment(equipment_id)
    if not equip:
        raise HTTPException(status_code=404, detail=f"Equipment {equipment_id} not found.")
    return compute_rul(equipment_id).to_dict()

@router.get("/rul")
async def plant_rul_summary() -> dict:
    """RUL summary across all equipment."""
    return get_plant_rul_summary()
