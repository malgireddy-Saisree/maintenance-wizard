"""
Router: /api/agents
One endpoint per agent + feedback + streaming chat.
"""

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agents import (
    diagnostic_agent, recommendation_agent, risk_scoring_agent,
    anomaly_detection_agent, report_agent, conversational_agent,
)
from agents.feedback_agent import record_feedback, get_feedback_summary, build_feedback_injection
from utils.vector_store import index_status
from utils.azure_client import get_client
from config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/agents", tags=["Agents"])


# ── Request models ────────────────────────────────────────────────────────

class Message(BaseModel):
    role: str
    content: str

class DiagnosticRequest(BaseModel):
    query: str
    equipment_id: Optional[str] = None
    conversation_history: list[Message] = Field(default_factory=list)

class RecommendationRequest(BaseModel):
    diagnosis: str
    equipment_id: Optional[str] = None

class RiskRequest(BaseModel):
    equipment_id: str

class AnomalyRequest(BaseModel):
    use_llm_enrichment: bool = True

class ReportRequest(BaseModel):
    report_type: str = "full_assessment"
    equipment_id: Optional[str] = "RM-04"

class ChatRequest(BaseModel):
    message: str
    conversation_history: list[Message] = Field(default_factory=list)
    equipment_id: Optional[str] = None
    stream: bool = False

class FeedbackRequest(BaseModel):
    agent_name: str
    original_query: str
    original_response: str
    rating: str                        # "correct" | "incorrect" | "partial"
    engineer_correction: Optional[str] = None
    equipment_id: Optional[str] = None


# ── Agent endpoints ───────────────────────────────────────────────────────

@router.post("/diagnose")
async def diagnose(req: DiagnosticRequest) -> dict:
    """Diagnostic Agent — RAG-grounded fault diagnosis."""
    _require_index()
    try:
        history = [m.model_dump() for m in req.conversation_history]
        # Inject feedback corrections
        feedback_hint = build_feedback_injection("diagnostic_agent")
        query = req.query + (f"\n\n{feedback_hint}" if feedback_hint else "")
        return await diagnostic_agent.run(
            query=query, equipment_id=req.equipment_id,
            conversation_history=history,
        )
    except Exception as exc:
        logger.error("diagnose error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/recommend")
async def recommend(req: RecommendationRequest) -> dict:
    """Recommendation Agent — SOP-grounded maintenance plan."""
    _require_index()
    try:
        return await recommendation_agent.run(
            diagnosis=req.diagnosis, equipment_id=req.equipment_id
        )
    except Exception as exc:
        logger.error("recommend error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/risk")
async def risk_score(req: RiskRequest) -> dict:
    """Risk Scoring Agent — structured JSON risk assessment."""
    _require_index()
    try:
        return await risk_scoring_agent.run(equipment_id=req.equipment_id)
    except Exception as exc:
        logger.error("risk error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/anomalies")
async def detect_anomalies(req: AnomalyRequest) -> dict:
    """Anomaly Detection Agent — plant-wide sensor sweep."""
    try:
        return await anomaly_detection_agent.run(use_llm_enrichment=req.use_llm_enrichment)
    except Exception as exc:
        logger.error("anomalies error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/report")
async def generate_report(req: ReportRequest) -> dict:
    """Report Generation Agent — Markdown reports."""
    _require_index()
    try:
        return await report_agent.run(report_type=req.report_type, equipment_id=req.equipment_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("report error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/chat")
async def chat(req: ChatRequest):
    """
    Conversational Agent — multi-turn chat.
    Supports streaming (stream=true) via Server-Sent Events.
    """
    history = [m.model_dump() for m in req.conversation_history]

    if req.stream:
        return StreamingResponse(
            _stream_chat(req.message, history, req.equipment_id),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    try:
        return await conversational_agent.run(
            user_message=req.message,
            conversation_history=history,
            equipment_id=req.equipment_id,
        )
    except Exception as exc:
        logger.error("chat error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


async def _stream_chat(message: str, history: list, equipment_id: Optional[str]):
    """Stream chat response token by token via SSE."""
    s = get_settings()
    client = get_client()
    idx = index_status()

    # Build a simple system prompt for streaming (no full RAG to keep latency low)
    from data.knowledge_base import ACTIVE_ALERTS, EQUIPMENT_REGISTRY, get_low_stock_spares
    alerts_summary = "; ".join(f"{a['equipment_id']}: {a['message'][:60]}" for a in ACTIVE_ALERTS if not a["acknowledged"])
    equip_summary = ", ".join(f"{e['id']} ({e['name']})" for e in EQUIPMENT_REGISTRY)

    system = (
        f"You are MaintenanceWizard for Tata Steel Jamshedpur. "
        f"Equipment: {equip_summary}. "
        f"Active alerts: {alerts_summary}. "
        f"{'RAG index built — answers grounded in manuals and SOPs.' if idx['built'] else 'RAG index not built.'}"
        f"{f' Focus: {equipment_id}' if equipment_id else ''}"
    )

    messages = [{"role": "system", "content": system}]
    messages.extend(history[-(6 * 2):])
    messages.append({"role": "user", "content": message})

    full_response = ""
    try:
        stream = await client.chat.completions.create(
            model=s.azure_chat_deployment,
            messages=messages,
            max_tokens=1200,
            temperature=0.2,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                token = chunk.choices[0].delta.content
                full_response += token
                yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
                await asyncio.sleep(0)  # yield to event loop

        yield f"data: {json.dumps({'token': '', 'done': True, 'full': full_response})}\n\n"
    except Exception as exc:
        yield f"data: {json.dumps({'error': str(exc), 'done': True})}\n\n"


# ── Feedback endpoint ─────────────────────────────────────────────────────

@router.post("/feedback")
async def submit_feedback(req: FeedbackRequest) -> dict:
    """
    Feedback Loop Agent — engineer rates and corrects AI responses.
    Corrections are distilled into few-shot examples for future improvement.
    """
    try:
        return await record_feedback(
            agent_name=req.agent_name,
            original_query=req.original_query,
            original_response=req.original_response,
            rating=req.rating,
            engineer_correction=req.engineer_correction,
            equipment_id=req.equipment_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("feedback error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/feedback/summary")
async def feedback_summary() -> dict:
    """Return aggregated feedback statistics."""
    return get_feedback_summary()


# ── Helper ────────────────────────────────────────────────────────────────

def _require_index() -> None:
    status = index_status()
    if not status["built"]:
        raise HTTPException(
            status_code=503,
            detail="Vector index not built. POST /api/rag/build first.",
        )


# ── Proactive monitoring endpoint ─────────────────────────────────────────

from agents.proactive_monitoring_agent import run as proactive_run

class ProactiveRequest(BaseModel):
    include_llm_report: bool = True

@router.post("/monitor")
async def proactive_monitor(req: ProactiveRequest) -> dict:
    """
    Proactive Monitoring Agent — runs autonomous plant-wide scan.
    No user query needed. Detects early warnings and cross-equipment correlations.
    """
    try:
        return await proactive_run(include_llm_report=req.include_llm_report)
    except Exception as exc:
        logger.error("monitor error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Maintenance scheduler endpoint ────────────────────────────────────────

from agents.maintenance_scheduler_agent import run as scheduler_run

class SchedulerRequest(BaseModel):
    available_crew: int = 2
    shutdown_window_hours: int = 8
    budget_inr: Optional[int] = None
    defer_equipment: list[str] = Field(default_factory=list)

@router.post("/schedule")
async def maintenance_schedule(req: SchedulerRequest) -> dict:
    """
    Maintenance Scheduler Agent — priority-ranked schedule across all equipment.
    Respects crew, time, and budget constraints.
    """
    try:
        constraints = {
            "available_crew": req.available_crew,
            "shutdown_window_hours": req.shutdown_window_hours,
            "budget_inr": req.budget_inr,
            "defer_equipment": req.defer_equipment,
        }
        return await scheduler_run(constraints=constraints)
    except Exception as exc:
        logger.error("schedule error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Full Analysis — chained Diagnose → Recommend in one call ─────────────

class FullAnalysisRequest(BaseModel):
    equipment_id: str
    query: Optional[str] = None

@router.post("/full_analysis")
async def full_analysis(req: FullAnalysisRequest) -> dict:
    """
    Chains Diagnostic Agent → Recommendation Agent automatically.
    One click triggers a two-agent pipeline:
    1. Diagnose fault from sensor data + RAG
    2. Feed diagnosis into Recommendation Agent for action plan
    Returns combined result with confidence score and cost impact.
    """
    _require_index()
    from data.knowledge_base import SENSOR_READINGS, ACTIVE_ALERTS
    from utils.rul_calculator import compute_rul

    equip_id = req.equipment_id
    query = req.query or (
        f"Analyse all sensor readings and active alerts for {equip_id}. "
        f"Identify the most critical issue and its root cause."
    )

    try:
        # Step 1: Diagnostic Agent
        diag_result = await diagnostic_agent.run(
            query=query,
            equipment_id=equip_id,
            conversation_history=[],
        )

        # Step 2: Recommendation Agent (fed with diagnosis)
        rec_result = await recommendation_agent.run(
            diagnosis=diag_result["response"],
            equipment_id=equip_id,
        )

        # Step 3: RUL (deterministic, no LLM cost)
        from utils.rul_calculator import compute_rul
        rul = compute_rul(equip_id).to_dict()

        # Step 4: Confidence score from RAG sources
        all_sources = diag_result.get("sources", []) + rec_result.get("sources", [])
        confidence = round(
            sum(s["score"] for s in all_sources) / len(all_sources) * 100, 1
        ) if all_sources else 0

        # Step 5: Cost impact
        from agents.proactive_monitoring_agent import EQUIPMENT_DOWNTIME_COST
        hourly_cost = EQUIPMENT_DOWNTIME_COST.get(equip_id, 2_000_000)
        repair_hours = 6
        failure_hours = 48
        repair_cost = hourly_cost * repair_hours * 0.15
        failure_cost = hourly_cost * failure_hours

        return {
            "equipment_id": equip_id,
            "diagnosis": diag_result["response"],
            "diagnosis_sources": diag_result.get("sources", []),
            "recommendations": rec_result["response"],
            "recommendation_sources": rec_result.get("sources", []),
            "rul": rul,
            "confidence_pct": confidence,
            "cost_impact": {
                "repair_now_inr": round(repair_cost),
                "failure_risk_inr": round(failure_cost),
                "repair_now_display": f"₹{repair_cost/100000:.1f}L",
                "failure_risk_display": f"₹{failure_cost/100000:.1f}L",
                "savings_display": f"₹{(failure_cost - repair_cost)/100000:.1f}L saved by acting now",
            },
            "total_sources": len(all_sources),
        }

    except Exception as exc:
        logger.error("full_analysis error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Emergency Actions — "What do I do RIGHT NOW?" ────────────────────────

@router.post("/emergency_actions")
async def emergency_actions() -> dict:
    """
    Top 3 immediate actions for this shift.
    Runs anomaly scan + risk scores + proactive monitor in parallel.
    One click = full plant situational awareness.
    """
    import asyncio
    from agents.proactive_monitoring_agent import (
        _early_warning_rules, _detect_cross_equipment_correlations,
        _compute_business_impact, EQUIPMENT_DOWNTIME_COST
    )
    from utils.rul_calculator import get_plant_rul_summary
    from data.knowledge_base import EQUIPMENT_REGISTRY

    try:
        # Run everything in parallel
        anomaly_task = asyncio.create_task(
            anomaly_detection_agent.run(use_llm_enrichment=False)
        )

        # Rule-based (instant, no API cost)
        warnings = _early_warning_rules()
        correlations = _detect_cross_equipment_correlations()
        impact = _compute_business_impact(warnings, correlations)
        rul_summary = get_plant_rul_summary()
        anomaly_result = await anomaly_task

        # Build top 3 actions ranked by urgency + cost
        actions = []

        # Critical correlations first
        for c in correlations:
            if c.get("severity") == "critical":
                equip_id = c.get("equipment_id", "Multiple")
                cost = EQUIPMENT_DOWNTIME_COST.get(equip_id, 2_000_000)
                actions.append({
                    "rank": len(actions) + 1,
                    "urgency": "IMMEDIATE",
                    "equipment_id": equip_id,
                    "action": c["message"],
                    "why": "Cross-equipment correlation indicates compound failure risk",
                    "cost_if_ignored": f"₹{cost * 48 / 100000:.0f}L (48h unplanned downtime)",
                    "color": "#ef4444",
                })

        # RUL < 24h
        for r in rul_summary.get("equipment_rul", []):
            if r.get("rul_hours") and r["rul_hours"] < 24:
                equip_id = r["equipment_id"]
                actions.append({
                    "rank": len(actions) + 1,
                    "urgency": "WITHIN 4 HOURS",
                    "equipment_id": equip_id,
                    "action": f"{r['equipment_name']}: {r['recommendation']}",
                    "why": f"RUL: {r['rul_display']} — {r['failure_mode'].replace('_',' ')}",
                    "cost_if_ignored": f"₹{EQUIPMENT_DOWNTIME_COST.get(equip_id, 2000000) * 6 / 100000:.0f}L (corrective repair)",
                    "color": "#f97316",
                })

        # High severity sensor warnings
        for w in warnings:
            if w.get("severity") == "high" and len(actions) < 5:
                actions.append({
                    "rank": len(actions) + 1,
                    "urgency": "WITHIN 24 HOURS",
                    "equipment_id": w["equipment_id"],
                    "action": w["message"],
                    "why": f"Sensor trending toward failure threshold",
                    "cost_if_ignored": "Escalation to emergency repair",
                    "color": "#f59e0b",
                })

        return {
            "top_actions": actions[:3],
            "all_actions": actions,
            "business_impact": impact,
            "anomaly_count": len(anomaly_result.get("anomalies", [])),
            "critical_rul_count": rul_summary.get("critical_count", 0),
            "generated_at": __import__("datetime").datetime.now().isoformat(),
        }

    except Exception as exc:
        logger.error("emergency_actions error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
