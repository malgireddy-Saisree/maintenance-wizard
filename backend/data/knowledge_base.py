"""
Structured knowledge base: equipment registry, sensor readings,
active alerts, maintenance history, spare parts inventory.
In production these would be fetched from SCADA / ERP / CMMS systems.
"""

from datetime import date

EQUIPMENT_REGISTRY = [
    {
        "id": "BF-01",
        "name": "Blast Furnace #1",
        "type": "blast_furnace",
        "criticality": "critical",
        "location": "Zone A - Ironmaking",
        "last_maintenance": "2026-04-15",
        "install_year": 2008,
        "sensors": ["temperature", "pressure", "gas_flow", "slag_viscosity", "tuyere_temp"],
        "operating_hours": 152640,
    },
    {
        "id": "BOF-02",
        "name": "Basic Oxygen Furnace #2",
        "type": "bof",
        "criticality": "critical",
        "location": "Zone B - Steelmaking",
        "last_maintenance": "2026-05-01",
        "install_year": 2012,
        "sensors": ["temperature", "oxygen_flow", "lance_pressure", "carbon_level"],
        "operating_hours": 105120,
    },
    {
        "id": "CC-03",
        "name": "Continuous Caster #3",
        "type": "continuous_caster",
        "criticality": "high",
        "location": "Zone C - Casting",
        "last_maintenance": "2026-03-22",
        "install_year": 2015,
        "sensors": ["mold_temperature", "cooling_water_flow", "strand_speed", "oscillation_freq"],
        "operating_hours": 88800,
    },
    {
        "id": "RM-04",
        "name": "Rolling Mill #4",
        "type": "rolling_mill",
        "criticality": "high",
        "location": "Zone D - Rolling",
        "last_maintenance": "2026-05-10",
        "install_year": 2010,
        "sensors": ["roll_force", "roll_speed", "strip_thickness", "motor_current", "bearing_temp"],
        "operating_hours": 131040,
    },
    {
        "id": "HX-05",
        "name": "Heat Exchanger Unit #5",
        "type": "heat_exchanger",
        "criticality": "medium",
        "location": "Zone E - Utilities",
        "last_maintenance": "2026-02-18",
        "install_year": 2016,
        "sensors": ["inlet_temp", "outlet_temp", "flow_rate", "pressure_differential"],
        "operating_hours": 79200,
    },
    {
        "id": "CR-06",
        "name": "Crane #6 (Hot Metal)",
        "type": "overhead_crane",
        "criticality": "high",
        "location": "Zone A - Ironmaking",
        "last_maintenance": "2026-04-30",
        "install_year": 2014,
        "sensors": ["load_cell", "motor_temp", "brake_wear", "hoist_speed"],
        "operating_hours": 96000,
    },
]

SENSOR_READINGS = {
    "BF-01": {
        "temperature":    {"value": 1485, "unit": "°C",       "normal_range": [1450, 1520], "status": "normal"},
        "pressure":       {"value": 4.2,  "unit": "bar",      "normal_range": [3.8, 4.5],   "status": "normal"},
        "gas_flow":       {"value": 287,  "unit": "Nm³/min",  "normal_range": [260, 310],   "status": "normal"},
        "slag_viscosity": {"value": 3.8,  "unit": "Pa·s",     "normal_range": [2.5, 5.0],   "status": "normal"},
        "tuyere_temp":    {"value": 248,  "unit": "°C",       "normal_range": [180, 280],   "status": "warning", "trend": "rising"},
    },
    "BOF-02": {
        "temperature":    {"value": 1620, "unit": "°C",       "normal_range": [1580, 1660], "status": "normal"},
        "oxygen_flow":    {"value": 520,  "unit": "Nm³/min",  "normal_range": [480, 560],   "status": "normal"},
        "lance_pressure": {"value": 12.4, "unit": "bar",      "normal_range": [11.0, 14.0], "status": "normal"},
        "carbon_level":   {"value": 0.04, "unit": "%",        "normal_range": [0.02, 0.08], "status": "normal"},
    },
    "CC-03": {
        "mold_temperature":    {"value": 198,  "unit": "°C",     "normal_range": [180, 220],   "status": "normal"},
        "cooling_water_flow":  {"value": 2340, "unit": "L/min",  "normal_range": [2200, 2600], "status": "normal"},
        "strand_speed":        {"value": 1.25, "unit": "m/min",  "normal_range": [1.0, 1.5],   "status": "normal"},
        "oscillation_freq":    {"value": 142,  "unit": "rpm",    "normal_range": [120, 160],   "status": "normal"},
    },
    "RM-04": {
        "roll_force":      {"value": 18400, "unit": "kN",  "normal_range": [15000, 22000], "status": "normal"},
        "roll_speed":      {"value": 12.8,  "unit": "m/s", "normal_range": [10, 16],       "status": "normal"},
        "strip_thickness": {"value": 6.02,  "unit": "mm",  "normal_range": [5.95, 6.10],  "status": "normal"},
        "motor_current":   {"value": 892,   "unit": "A",   "normal_range": [750, 950],     "status": "warning", "trend": "rising"},
        "bearing_temp":    {"value": 74,    "unit": "°C",  "normal_range": [40, 80],       "status": "warning", "trend": "rising"},
    },
    "HX-05": {
        "inlet_temp":           {"value": 185,  "unit": "°C",  "normal_range": [170, 200], "status": "normal"},
        "outlet_temp":          {"value": 42,   "unit": "°C",  "normal_range": [35, 50],   "status": "normal"},
        "flow_rate":            {"value": 1820, "unit": "L/hr","normal_range": [1600, 2000],"status": "normal"},
        "pressure_differential":{"value": 1.8,  "unit": "bar", "normal_range": [0.8, 2.5], "status": "normal"},
    },
    "CR-06": {
        "load_cell":   {"value": 42.5, "unit": "tonnes", "normal_range": [0, 80],   "status": "normal"},
        "motor_temp":  {"value": 68,   "unit": "°C",     "normal_range": [40, 85],  "status": "normal"},
        "brake_wear":  {"value": 72,   "unit": "%",      "normal_range": [0, 80],   "status": "warning", "trend": "rising"},
        "hoist_speed": {"value": 8.2,  "unit": "m/min",  "normal_range": [5, 12],   "status": "normal"},
    },
}

ACTIVE_ALERTS = [
    {
        "id": "ALT-001",
        "equipment_id": "RM-04",
        "severity": "high",
        "parameter": "bearing_temp",
        "message": "Bearing temperature rising trend on Rolling Mill #4. Current: 74°C, increasing at ~2°C/hr over last 6 hours.",
        "timestamp": "2026-06-06T08:15:00",
        "acknowledged": False,
    },
    {
        "id": "ALT-002",
        "equipment_id": "RM-04",
        "severity": "medium",
        "parameter": "motor_current",
        "message": "Motor current elevated above normal range (892A vs 750-950A). May indicate mechanical resistance.",
        "timestamp": "2026-06-06T09:00:00",
        "acknowledged": False,
    },
    {
        "id": "ALT-003",
        "equipment_id": "BF-01",
        "severity": "medium",
        "parameter": "tuyere_temp",
        "message": "Tuyere temperature trending upward at 248°C. Approaching 280°C upper limit. Monitor cooling water flow.",
        "timestamp": "2026-06-06T07:30:00",
        "acknowledged": True,
    },
    {
        "id": "ALT-004",
        "equipment_id": "CR-06",
        "severity": "low",
        "parameter": "brake_wear",
        "message": "Brake pad wear at 72%. Approaching replacement threshold (80%). Schedule during next planned shutdown.",
        "timestamp": "2026-06-05T14:00:00",
        "acknowledged": True,
    },
]

MAINTENANCE_HISTORY = [
    {
        "id": "MR-2026-001",
        "equipment_id": "BF-01",
        "date": "2026-04-15",
        "type": "Planned",
        "action": "Cooling stave inspection and replacement (Zones 7-9). 3 staves replaced. Tuyere nose wear measured — within tolerance.",
        "duration_hours": 18,
        "outcome": "Successful",
        "technician": "Rajesh Kumar",
        "spares_used": ["Cooling Stave (x3)", "Tuyere Gasket (x12)"],
        "cost_inr": 245000,
    },
    {
        "id": "MR-2026-002",
        "equipment_id": "RM-04",
        "date": "2026-05-10",
        "type": "Corrective",
        "action": "Work roll bearing failure — Bearing #3 on drive side replaced.",
        "duration_hours": 6,
        "outcome": "Successful",
        "technician": "Suresh Patel",
        "spares_used": ["SKF 23138 CC/W33 Bearing (x1)", "Grease Line (x2m)"],
        "cost_inr": 42000,
        "root_cause": "Blocked grease nipple causing lubrication starvation of Bearing #3",
    },
    {
        "id": "MR-2026-003",
        "equipment_id": "CC-03",
        "date": "2026-03-22",
        "type": "Planned",
        "action": "Mold copper plate inspection. Taper measurement and adjustment. Oscillation table lubrication.",
        "duration_hours": 12,
        "outcome": "Successful",
        "technician": "Anand Mishra",
        "spares_used": ["Copper Plate (x2)", "Oscillation Bearings (x4)"],
        "cost_inr": 185000,
    },
    {
        "id": "MR-2026-004",
        "equipment_id": "BF-01",
        "date": "2026-01-08",
        "type": "Emergency",
        "action": "Tuyere #14 burn-through. Emergency tuyere replacement. Hot metal spillage contained.",
        "duration_hours": 4,
        "outcome": "Successful",
        "technician": "Rajesh Kumar",
        "spares_used": ["Tuyere Stock (x1)", "Refractory Patch (x50kg)"],
        "cost_inr": 78000,
        "root_cause": "Cooling water flow restriction — calcium carbonate scale in tuyere cooling circuit",
    },
]

SPARE_PARTS_INVENTORY = [
    {"id": "SP-001", "name": "SKF 23138 CC/W33 Bearing",    "qty": 2,  "min_stock": 2, "lead_time": "14 days", "cost_inr": 18500,  "equipments": ["RM-04"]},
    {"id": "SP-002", "name": "Tuyere Stock (Cast Copper)",   "qty": 6,  "min_stock": 4, "lead_time": "21 days", "cost_inr": 32000,  "equipments": ["BF-01"]},
    {"id": "SP-003", "name": "Cooling Stave (Cast Iron)",    "qty": 4,  "min_stock": 2, "lead_time": "30 days", "cost_inr": 68000,  "equipments": ["BF-01"]},
    {"id": "SP-004", "name": "Mold Copper Plate",            "qty": 1,  "min_stock": 2, "lead_time": "45 days", "cost_inr": 95000,  "equipments": ["CC-03"]},
    {"id": "SP-005", "name": "Oscillation Bearing Set",      "qty": 8,  "min_stock": 4, "lead_time": "10 days", "cost_inr": 12000,  "equipments": ["CC-03"]},
    {"id": "SP-006", "name": "Grease Line Assembly",         "qty": 12, "min_stock": 6, "lead_time": "3 days",  "cost_inr": 850,    "equipments": ["RM-04"]},
    {"id": "SP-007", "name": "Refractory Mortar (25kg bag)", "qty": 45, "min_stock": 20,"lead_time": "5 days",  "cost_inr": 2200,   "equipments": ["BF-01", "BOF-02"]},
    {"id": "SP-008", "name": "Brake Pad Set (Crane)",        "qty": 3,  "min_stock": 4, "lead_time": "7 days",  "cost_inr": 14000,  "equipments": ["CR-06"]},
]


def get_equipment(equipment_id: str | None = None) -> list:
    if equipment_id:
        return [e for e in EQUIPMENT_REGISTRY if e["id"] == equipment_id]
    return EQUIPMENT_REGISTRY


def get_sensors(equipment_id: str | None = None) -> dict:
    if equipment_id:
        return {equipment_id: SENSOR_READINGS.get(equipment_id, {})}
    return SENSOR_READINGS


def get_alerts(equipment_id: str | None = None) -> list:
    if equipment_id:
        return [a for a in ACTIVE_ALERTS if a["equipment_id"] == equipment_id]
    return ACTIVE_ALERTS


def get_history(equipment_id: str | None = None, limit: int = 5) -> list:
    records = MAINTENANCE_HISTORY
    if equipment_id:
        records = [m for m in records if m["equipment_id"] == equipment_id]
    return records[-limit:]


def get_spares(equipment_id: str | None = None) -> list:
    if equipment_id:
        return [s for s in SPARE_PARTS_INVENTORY if equipment_id in s.get("equipments", [])]
    return SPARE_PARTS_INVENTORY


def get_low_stock_spares() -> list:
    return [s for s in SPARE_PARTS_INVENTORY if s["qty"] <= s["min_stock"]]
