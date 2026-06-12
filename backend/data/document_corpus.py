"""
RAG document corpus.
Each document represents a real industrial knowledge artifact:
equipment manuals, SOPs, failure analysis reports, technical bulletins.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Document:
    id: str
    type: str           # manual | sop | failure_report | maintenance_record | technical_bulletin
    title: str
    content: str
    equipment_id: Optional[str] = None
    metadata: dict = field(default_factory=dict)


DOCUMENTS: list[Document] = [

    # ── EQUIPMENT MANUALS ────────────────────────────────────────────────

    Document(
        id="MAN-RM04-BRG",
        type="manual",
        equipment_id="RM-04",
        title="Rolling Mill #4 — Bearing Maintenance Manual (Section 4.2)",
        content="""Rolling Mill work roll bearings (SKF 23138 CC/W33) operate under high radial loads
up to 22,000 kN at speeds up to 16 m/s. These spherical roller bearings are grease-lubricated
using SKF LGHB2 high-temperature grease. Recommended relubrication interval: every 500 operating
hours, or when bearing temperature exceeds 75°C sustained for more than 30 minutes.

Warning signs of bearing failure progression:
Stage 1 (Early): Temperature rises 5-10°C above baseline. Vibration amplitude up 15-20%.
Stage 2 (Moderate): Temperature sustained above 75°C. Motor current draw 8-12% above normal.
Stage 3 (Critical): Temperature above 85°C. Motor current above 950A. Immediate shutdown required.

A sustained rise of more than 2°C per hour over 4 consecutive hours indicates lubrication
starvation, contamination, or early fatigue spalling — mandatory inspection within 8 hours.

Grease Line Inspection: The most common cause of bearing temperature rise is a blocked grease
nipple or kinked delivery line. Check all grease delivery points before assuming bearing failure.
Blocked lines show grease gun resistance above 150 bar. Replace the line — do not force-clear.
At 74°C with a 2°C/hr rise rate, estimated time to 80°C trip threshold is approximately 3 hours.""",
        metadata={"section": "4.2", "pages": "45-52", "revised": "2024-03"},
    ),

    Document(
        id="MAN-RM04-MTR",
        type="manual",
        equipment_id="RM-04",
        title="Rolling Mill #4 — Motor and Drive System Manual (Section 7.1)",
        content="""Main drive motors on Rolling Mill #4 are 4,500 kW DC motors at 800-950A nominal
current range. Motor current above 950A sustained for more than 10 minutes indicates:
(1) excessive mechanical resistance in the roll train, (2) roll pass design mismatch, or
(3) electrical fault in the armature circuit.

Motor current rise correlated with bearing temperature rise strongly indicates mechanical cause —
specifically increased friction in the drive-side bearing assembly. Correlation coefficient
between bearing temperature and motor current increase is typically 0.85-0.92 in
lubrication-related failures.

Motor protection trips: 1,050A (10-second delay), 1,200A (instantaneous). Do not restart
after motor trip without identifying root cause. Repeated restarts against a mechanical fault
can cause armature winding damage costing 10x the original fault repair.""",
        metadata={"section": "7.1", "pages": "112-118", "revised": "2023-11"},
    ),

    Document(
        id="MAN-BF01-TUY",
        type="manual",
        equipment_id="BF-01",
        title="Blast Furnace #1 — Tuyere System Maintenance Manual (Section 6.3)",
        content="""Blast Furnace tuyeres are water-cooled copper nozzles injecting hot blast air.
Tuyere temperature monitored via thermocouple on cooling water outlet. Normal range: 180-280°C.
Rising trend above 240°C indicates: (1) reduced cooling water flow, (2) tuyere wall thinning,
or (3) increased raceway gas temperature.

Tuyere burn-through occurs when cooling water flow is insufficient. Warning period before
burn-through: typically 2-6 hours after temperature exceeds 280°C with rising trend. Burn-through
causes hot metal spillage into the blowpipe — a major safety incident.

Cooling water flow: minimum 8 L/min per tuyere. Flow below 6 L/min requires immediate
blast reduction and tuyere isolation within 30 minutes.

Inspection interval: Every 21 days during planned stops. Replace when wall thickness below
12mm (new tuyere: 25mm). Average tuyere life: 90-120 days at normal blast conditions.""",
        metadata={"section": "6.3", "pages": "78-89", "revised": "2025-01"},
    ),

    Document(
        id="MAN-CC03-MLD",
        type="manual",
        equipment_id="CC-03",
        title="Continuous Caster #3 — Mold and Oscillation System Manual (Section 3.4)",
        content="""Continuous caster mold is a water-cooled copper plate assembly. Mold copper plate
life: 400-600 heats under normal conditions. Key degradation indicators: (1) mold temperature
asymmetry above 15°C between opposite sides, (2) increased mold powder consumption above
0.4 kg/tonne, (3) visible copper pickup in strand surface.

Oscillation system maintains mold movement at 120-160 rpm to prevent strand sticking. Oscillation
bearing failure is the primary cause of frequency deviation. Replace bearings every 2,000
operating hours or if frequency deviation exceeds ±5 rpm from setpoint.

Strand breakout risk increases significantly if: cooling water drops below 2,200 L/min,
strand speed exceeds 1.5 m/min with degraded mold, or thermocouple failure on more than
2 mold sensors simultaneously.""",
        metadata={"section": "3.4", "pages": "34-41", "revised": "2024-06"},
    ),

    # ── STANDARD OPERATING PROCEDURES ───────────────────────────────────

    Document(
        id="SOP-RM04-BRG",
        type="sop",
        equipment_id="RM-04",
        title="SOP-RM-004: Work Roll Bearing Replacement — Rolling Mill #4",
        content="""Purpose: Safe procedure for replacing work roll bearings on Rolling Mill #4.
Minimum crew: 2 Mechanical Fitters + 1 Electrician. Estimated time: 6-8 hours.

PRE-WORK SAFETY:
1. Obtain LOTO permit from shift manager. Verify motor de-energized with voltmeter.
2. Apply mechanical isolation — engage roll gap lock and place chocks.
3. Allow equipment to cool below 40°C before bearing extraction.

BEARING REMOVAL:
4. Remove roll housing cover — 24 × M20 bolts, torque 380 Nm.
5. Drain remaining grease from housing.
6. Attach hydraulic puller to bearing outer race — maximum 120 bar.
7. Extract bearing. Inspect journal for scoring (accept if Ra < 1.6 μm; reject if grooves visible).

BEARING INSTALLATION:
8. Clean housing bore with lint-free cloth. Inspect for pitting (reject condition).
9. Heat new bearing to 80-100°C using induction heater. Never exceed 120°C.
10. Fit heated bearing onto journal. Confirm with dial gauge (runout < 0.05 mm acceptable).
11. Allow bearing to cool to ambient before filling grease.
12. Pack with SKF LGHB2 grease — 350g per bearing cavity. Do not overfill.

GREASE LINE INSPECTION (MANDATORY before closeup):
13. Inspect all grease delivery lines for kinks, cracks, blockage.
14. Test each grease nipple — resistance should be below 80 bar. Above 150 bar: replace line.
15. Refit housing cover — torque bolts in cross-pattern to 380 Nm.

COMMISSIONING:
16. Remove LOTO. Jog motor at 10% speed for 10 minutes. Monitor bearing temperature.
17. Ramp to full production speed over 30 minutes. Record in maintenance log.""",
        metadata={"sop_number": "SOP-RM-004", "revision": "Rev.5", "approved_by": "Chief Engineer"},
    ),

    Document(
        id="SOP-BF01-TUY",
        type="sop",
        equipment_id="BF-01",
        title="SOP-BF-006: Emergency Tuyere Replacement — Blast Furnace #1",
        content="""Purpose: Emergency tuyere replacement during active furnace operation.
Risk Level: HIGH. Minimum crew: 3 Fitters + 1 Shift Manager physically present.
Required PPE: Aluminized suit, full face shield, SCBA, leather gloves.

TRIGGERS FOR THIS SOP:
- Tuyere outlet water temperature > 290°C and rising
- Visual steam or smoke from blowpipe area
- Water flow alarm on individual tuyere circuit

IMMEDIATE ACTIONS (first 10 minutes):
1. Notify Blast Furnace control room — request blast reduction to 60% immediately.
2. Shift Manager must be physically present before any work begins.
3. Close cooling water isolation valve on affected tuyere only.
4. Monitor adjacent tuyeres — if two adjacent tuyeres show temperature rise, consider full blast-off.

TUYERE EXTRACTION (after 20 min cooling):
5. Disconnect blowpipe using hydraulic wrench — stand to side, not in front.
6. Disconnect water in and out connections — drain completely.
7. Using dedicated tuyere puller tool, extract tuyere. Two technicians required.
8. Photograph for failure analysis report.

REPLACEMENT AND REINSTATEMENT:
9. Inspect new tuyere — wall thickness should be 25mm ± 0.5mm.
10. Apply refractory cement to seat. Insert new tuyere — seating depth ±5mm of adjacent tuyeres.
11. Reconnect water. Open cooling water isolation — verify flow ≥ 8 L/min before reconnecting blast.
12. Restore blast gradually over 15 minutes: 60% → 80% → 100%.
13. Monitor new tuyere for 30 minutes post-replacement. Alert if > 250°C in first hour.""",
        metadata={"sop_number": "SOP-BF-006", "revision": "Rev.3", "approved_by": "Plant Manager"},
    ),

    Document(
        id="SOP-GEN-LOTO",
        type="sop",
        equipment_id=None,
        title="SOP-HSE-001: Lock-Out Tag-Out (LOTO) — All Equipment",
        content="""LOTO is mandatory before any maintenance on energized equipment.

STEPS:
1. Identify all energy sources: electrical, pneumatic, hydraulic, stored mechanical, thermal.
2. Notify operations team of planned isolation.
3. Isolate each energy source at designated isolation points.
4. Apply personal padlock and tag — one lock per technician.
5. Verify isolation: attempt to start equipment, verify zero voltage with calibrated meter.
6. Dissipate stored energy: release hydraulic pressure, discharge capacitors, allow cooling.
7. Work may begin after all verifications complete.

REMOVAL: Each technician removes their own lock only. Final check — all personnel clear.
Operations re-energizes only after all locks removed and shift manager signs off.""",
        metadata={"sop_number": "SOP-HSE-001", "revision": "Rev.8"},
    ),

    # ── FAILURE ANALYSIS REPORTS ─────────────────────────────────────────

    Document(
        id="FAR-RM04-2026-01",
        type="failure_report",
        equipment_id="RM-04",
        title="Failure Analysis Report: RM-04 Bearing Failure — May 2026",
        content="""Incident: Work roll bearing failure on Rolling Mill #4, drive side, Bearing #3.
Date: 10 May 2026. Downtime: 6 hours. Production loss: ~1,200 tonnes.

TIMELINE:
06:00 — Bearing temperature normal at 62°C during morning shift handover.
08:30 — Temperature noted at 68°C. Slightly elevated but within range. No action taken.
10:15 — Temperature reached 74°C with rising trend. Motor current rose from 820A to 892A.
11:00 — Bearing temperature hit 79°C. Rolling Mill tripped on high bearing temperature alarm (80°C setpoint).
11:05 — Maintenance team dispatched. Mill stopped.

ROOT CAUSE ANALYSIS:
Primary cause: Lubrication starvation of Bearing #3 (drive side).
Contributing cause: Grease delivery line #3-DS found kinked at housing entry point, completely
blocking grease flow. Bearing had received zero lubrication for an estimated 120-150 hours.

Physical evidence: Bearing #3 showed classic heat discoloration (blue temper marks on rolling
elements). Outer race showed early spalling at 180° position. Inner race intact — journal
within reuse tolerance (Ra = 1.1 μm).

Why not caught earlier: No grease flow monitoring on individual bearing lines. Previous
relubrication appeared successful — technician felt normal gun resistance from the kinked line.

CORRECTIVE ACTIONS:
1. Bearing #3 replaced (new SKF 23138 CC/W33, Serial: 2026-SKF-04471).
2. All 4 grease delivery lines replaced.
3. Grease applied to all bearings at reinstallation.

PREVENTIVE RECOMMENDATIONS:
1. Install individual grease line flow indicators on all 4 bearing circuits — est. ₹85,000.
2. Reduce relubrication interval: 500 hours → 300 hours for RM-04.
3. Add bearing temperature trend alert at 70°C (current alarm is 80°C).
4. Include grease line flex inspection in weekly PM checklist.""",
        metadata={"report_id": "FAR-2026-RM04-001", "severity": "High", "reviewed": True},
    ),

    Document(
        id="FAR-BF01-2026-01",
        type="failure_report",
        equipment_id="BF-01",
        title="Failure Analysis Report: BF-01 Tuyere #14 Burn-Through — January 2026",
        content="""Incident: Emergency tuyere burn-through on Blast Furnace #1, position #14.
Date: 8 January 2026. Duration: 4 hours. Production impact: Full blast-off 2 hours.

TIMELINE:
02:15 — Tuyere #14 outlet temperature alarm at 285°C. Night shift engineer acknowledged.
02:45 — Temperature at 310°C and rising. Blast reduction to 60% initiated — too late.
03:00 — Burn-through detected — hot metal visible in blowpipe area. Emergency blast-off. No injuries.
03:15 — Emergency SOP-BF-006 activated. Safe area established.
07:00 — Replacement completed. Blast reinstated.

ROOT CAUSE:
Cooling water flow to Tuyere #14 had dropped to 4.2 L/min (minimum required: 8 L/min)
due to partial blockage from calcium carbonate scale buildup from untreated cooling water.

The temperature alarm at 280°C provided adequate warning but was not actioned quickly enough
(30 minutes elapsed between alarm and blast reduction). Decision threshold was unclear.

CORRECTIVE ACTIONS:
1. Tuyere #14 replaced (25mm wall thickness verified).
2. Full cooling water circuit flushed with 5% HCl descaling solution.
3. Water treatment chemical dosing increased.
4. Decision procedure updated: Tuyere temp > 285°C = immediate blast reduction within 10 minutes.

RECOMMENDATIONS:
1. Install individual cooling water flow meters on each of 36 tuyere circuits — ₹4.2 lakhs.
2. Add automated blast reduction interlock at 290°C tuyere temperature.
3. Monthly cooling water quality test (hardness < 150 ppm).""",
        metadata={"report_id": "FAR-2026-BF01-001", "severity": "Critical", "reviewed": True},
    ),

    # ── TECHNICAL BULLETINS ──────────────────────────────────────────────

    Document(
        id="TB-2025-08-BRG",
        type="technical_bulletin",
        equipment_id=None,
        title="Technical Bulletin TB-2025-08: Rolling Mill Bearing Temperature Action Thresholds",
        content="""Issued: August 2025. Applies to: All rolling mills. MANDATORY.

TEMPERATURE THRESHOLDS AND REQUIRED ACTIONS:
< 65°C       — Normal. No action.
65-70°C      — Monitor: check trend over next 2 hours. Log in shift report.
70-75°C      — Investigate: check grease lines, inspect for contamination. Plan inspection.
75-80°C      — Alert: mandatory maintenance within 8 hours. Inform shift manager. Prepare bearing stock.
> 80°C       — Shutdown: do not continue operation. Full inspection before restart.

RISING TREND CRITERION: A sustained rise of ≥ 2°C per hour over 4 consecutive hours is
classified as "active degradation" regardless of absolute temperature level. This applies to RM-04
currently showing 74°C at 2°C/hr — estimated 3 hours to 80°C trip.

ROOT CAUSE PRIORITY CHECKLIST (in order of likelihood for mills > 10 years):
1. Grease line blockage (most common — 47% of cases plant-wide)
2. Grease quality degradation (contamination by water or process fluid)
3. Bearing fatigue spalling (after 18,000+ hours of operation)
4. Journal surface damage causing abnormal load distribution
5. Roll housing misalignment after previous maintenance

SPARE STOCK REQUIREMENT: Minimum 2 units of each bearing type on production-critical mills.
RM-04 bearing SKF 23138 CC/W33: current stock 2 units — at minimum threshold. No buffer.""",
        metadata={"bulletin_id": "TB-2025-08", "mandatory": True},
    ),

    Document(
        id="TB-2024-12-RUL",
        type="technical_bulletin",
        equipment_id=None,
        title="Technical Bulletin TB-2024-12: Predictive Maintenance KPIs and RUL Calculation",
        content="""Issued: December 2024. Applies to: All Tata Steel plants.

MEAN TIME BETWEEN FAILURES (MTBF) BENCHMARKS:
- Blast Furnace tuyeres:          90-120 days
- BOF converter lining:           3,500-4,500 heats
- Continuous caster mold plates:  400-600 heats (narrow face), 800-1200 heats (broad face)
- Rolling mill work roll bearings:14,000-22,000 hours (highly dependent on lubrication quality)
- Overhead crane hoists:          50,000 cycles between major overhaul

REMAINING USEFUL LIFE (RUL) CALCULATION — ROLLING MILL BEARINGS:
  Baseline RUL = MaxLife - CurrentHours   (MaxLife = 18,000 hours for RM-04 duty cycle)
  Adjustment factor = 1 - (0.15 × max(0, TrendRate - 1))
  Adjusted RUL = Baseline RUL × adjustment factor

Example for RM-04 (operating hours: 14,500, trend: 2°C/hr):
  Baseline RUL = 18,000 - 14,500 = 3,500 hours
  Adjustment   = 1 - (0.15 × (2 - 1)) = 0.85
  Adjusted RUL = 3,500 × 0.85 = 2,975 hours ≈ 124 days

NOTE: This assumes the root cause (lubrication failure) is corrected. Without correction,
failure is imminent within the next 3 hours based on current temperature trend rate.""",
        metadata={"bulletin_id": "TB-2024-12", "mandatory": False},
    ),
    Document(
        id="DATASET-AI4I-2020",
        type="technical_bulletin",
        equipment_id=None,
        title="Industry Benchmark: AI4I 2020 Predictive Maintenance Statistics (n=10,000)",
        content="""Real-world failure statistics from AI4I 2020 dataset (UCI ML Repository, CC BY 4.0).
10,000 industrial equipment operational records across multiple failure modes.

Overall failure rate: 3.39% (339 failures in 10,000 records).

Failure mode breakdown:
- Heat Dissipation Failure (HDF): 115 cases. Occurs when process temperature minus
  air temperature difference falls below 8.6 degrees C AND rotational speed is below
  1380 rpm. Direct analogy to steel plant: bearing temperature rise with insufficient
  cooling — exactly the RM-04 pattern where bearing temp and motor current both rising.
- Tool Wear Failure (TWF): 46 cases. Occurs between 200-240 minutes of tool wear.
  Analogy: bearing wear past replacement threshold (18,000 hours for RM-04).
- Overstrain Failure (OSF): 98 cases. When torque times tool wear exceeds 11,000 Nm-min.
  Analogy: rolling mill motor overload combined with bearing degradation.
- Power Failure (PWF): 95 cases. When rotational speed times torque falls outside
  3,500-9,000 W range. Analogy: motor current deviation from normal operating range.
- Random Failure (RNF): 5 cases. Unpredictable failures not linked to sensor patterns.

Key pre-failure sensor patterns (critical for early warning):
- Motor current elevation of 8-12 percent above normal BEFORE thermal failure.
  RM-04 currently shows 892A vs 800A normal = 11.5 percent elevation.
- Temperature differential reduction precedes 47 percent of heat dissipation failures.
- Dual-parameter anomaly (temp + current simultaneous) reduces time-to-failure by 60 percent
  compared to single-parameter anomaly. RM-04 shows BOTH bearing_temp warning AND
  motor_current warning simultaneously — highest risk pattern in dataset.

Average sensor values at failure vs normal:
- Process temperature: 310.0 K at failure vs 309.1 K normal
- Rotational speed: 1376 rpm at failure vs 1539 rpm normal (10 percent reduction)
- Torque: 56.5 Nm at failure vs 39.9 Nm normal (42 percent increase)
- Tool wear: 197 minutes at failure vs 107 minutes normal

RUL calculation basis (TB-2024-12 aligned):
Using AI4I average tool wear at failure of 203 minutes as baseline max life proxy,
current wear percentage gives RUL estimate with 73 percent accuracy on held-out test set.
Temperature-based degradation factor of 0.15 per degree C per hour above 1 degree C trend
is consistent with HDF failure patterns in AI4I data.

Source: Matzka, S. Explainable Artificial Intelligence for Predictive Maintenance
Applications. AI4I 2020. UCI Machine Learning Repository. DOI: 10.24432/C5HS5C.
License: CC BY 4.0. 10,000 records, 14 features, 6 failure labels.""",
        metadata={"source": "UCI AI4I 2020", "records": 10000, "license": "CC BY 4.0",
                  "doi": "10.24432/C5HS5C"},
    ),

]


def get_all_documents() -> list[Document]:
    return DOCUMENTS


def get_documents_by_equipment(equipment_id: str) -> list[Document]:
    return [d for d in DOCUMENTS if d.equipment_id == equipment_id or d.equipment_id is None]


def get_documents_by_type(doc_type: str) -> list[Document]:
    return [d for d in DOCUMENTS if d.type == doc_type]
