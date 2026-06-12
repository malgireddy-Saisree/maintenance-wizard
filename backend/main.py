"""
Maintenance Wizard — FastAPI Application v3.0
──────────────────────────────────────────────
9 Agents, WebSocket real-time push, live sensor simulation,
persisted RAG index, full-analysis chaining.
"""

import asyncio
import json
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from routers.agents_router import router as agents_router
from routers.plant_router import router as plant_router
from routers.rag_router import router as rag_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Maintenance Wizard API",
    description=(
        "Agentic AI-powered maintenance decision-support system for Tata Steel. "
        "9 specialised agents: Diagnostic, Recommendation, Risk Scoring, "
        "Anomaly Detection, Report Generation, Conversational, "
        "Proactive Monitor, Maintenance Scheduler, Feedback Loop. "
        "Features: RAG with hybrid retrieval, streaming responses, "
        "live sensor simulation, WebSocket push, chained multi-agent analysis."
    ),
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents_router)
app.include_router(plant_router)
app.include_router(rag_router)


# ── Startup: load cached RAG index + start sensor simulator ──────────────

@app.on_event("startup")
async def startup():
    # Try to load persisted RAG index (avoids re-embedding on every restart)
    from utils.vector_store import try_load_cached_index
    loaded = try_load_cached_index()
    if loaded:
        logger.info("Startup | RAG index loaded from disk cache")
    else:
        logger.info("Startup | No RAG cache found — build index via /api/rag/build")

    # Start live sensor degradation loop
    from utils.sensor_simulator import run_degradation_loop
    asyncio.create_task(run_degradation_loop())
    logger.info("Startup | Sensor degradation simulator started")


# ── WebSocket endpoint — real-time sensor push ────────────────────────────

@app.websocket("/ws/sensors")
async def websocket_sensors(websocket: WebSocket):
    """
    WebSocket endpoint for real-time sensor updates and alerts.
    The sensor simulator broadcasts to all connected clients every 60 seconds.
    Connect from frontend: new WebSocket('ws://localhost:8000/ws/sensors')
    """
    from utils.sensor_simulator import register_ws, unregister_ws
    await websocket.accept()
    register_ws(websocket)
    try:
        # Send current sensor snapshot immediately on connect
        from data.knowledge_base import SENSOR_READINGS, ACTIVE_ALERTS
        await websocket.send_text(json.dumps({
            "type": "CONNECTED",
            "message": "Real-time sensor feed active",
            "unack_alerts": len([a for a in ACTIVE_ALERTS if not a["acknowledged"]]),
        }))
        # Keep connection alive — simulator will push updates
        while True:
            await asyncio.sleep(30)
            await websocket.send_text(json.dumps({"type": "PING"}))
    except WebSocketDisconnect:
        pass
    finally:
        unregister_ws(websocket)


# ── Health endpoints ──────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root() -> dict:
    from utils.vector_store import index_status
    return {
        "service": "Maintenance Wizard API",
        "version": "3.0.0",
        "agents": 9,
        "docs": "/docs",
        "rag_index": index_status(),
        "endpoints": {
            "agents": [
                "POST /api/agents/chat", "POST /api/agents/diagnose",
                "POST /api/agents/recommend", "POST /api/agents/risk",
                "POST /api/agents/anomalies", "POST /api/agents/report",
                "POST /api/agents/monitor", "POST /api/agents/schedule",
                "POST /api/agents/full_analysis", "POST /api/agents/emergency_actions",
                "POST /api/agents/feedback", "GET /api/agents/feedback/summary",
            ],
            "plant": [
                "GET /api/plant/dashboard", "GET /api/plant/equipment",
                "GET /api/plant/sensors", "GET /api/plant/alerts",
                "GET /api/plant/trends/{id}", "GET /api/plant/health",
                "GET /api/plant/rul", "GET /api/plant/rul/{id}",
            ],
            "rag": ["GET /api/rag/status", "POST /api/rag/build", "POST /api/rag/reset"],
            "websocket": ["WS /ws/sensors"],
        },
    }


@app.get("/health", tags=["Health"])
async def health() -> dict:
    from utils.vector_store import index_status
    from data.knowledge_base import ACTIVE_ALERTS, SENSOR_READINGS
    return {
        "status": "ok",
        "version": "3.0.0",
        "rag_index": index_status(),
        "live_sensors": {
            "RM-04_bearing_temp": SENSOR_READINGS["RM-04"]["bearing_temp"]["value"],
            "RM-04_motor_current": SENSOR_READINGS["RM-04"]["motor_current"]["value"],
            "BF-01_tuyere_temp": SENSOR_READINGS["BF-01"]["tuyere_temp"]["value"],
        },
        "unack_alerts": len([a for a in ACTIVE_ALERTS if not a["acknowledged"]]),
    }
