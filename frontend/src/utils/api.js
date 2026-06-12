// src/utils/api.js
// Single source of truth for all backend API calls.
// All components import from here — never fetch directly.

const BASE = "/api";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Plant data ────────────────────────────────────────────────────────────
export const plantApi = {
  dashboard: () => get("/plant/dashboard"),
  equipment: () => get("/plant/equipment"),
  equipmentDetail: (id) => get(`/plant/equipment/${id}`),
  sensors: (id) => get(id ? `/plant/sensors/${id}` : "/plant/sensors"),
  alerts: (unackOnly = false) => get(`/plant/alerts${unackOnly ? "?unacknowledged_only=true" : ""}`),
  history: (equipmentId, limit = 10) =>
    get(`/plant/history${equipmentId ? `?equipment_id=${equipmentId}&limit=${limit}` : `?limit=${limit}`}`),
  spares: (lowStockOnly = false) => get(`/plant/spares${lowStockOnly ? "?low_stock_only=true" : ""}`),
  acknowledgeAlert: (alertId) => post(`/plant/alerts/${alertId}/acknowledge`, {}),
};

// ── Agents ────────────────────────────────────────────────────────────────
export const agentApi = {
  chat: (message, conversationHistory = [], equipmentId = null) =>
    post("/agents/chat", { message, conversation_history: conversationHistory, equipment_id: equipmentId }),

  diagnose: (query, equipmentId = null, conversationHistory = []) =>
    post("/agents/diagnose", { query, equipment_id: equipmentId, conversation_history: conversationHistory }),

  recommend: (diagnosis, equipmentId = null) =>
    post("/agents/recommend", { diagnosis, equipment_id: equipmentId }),

  riskScore: (equipmentId) =>
    post("/agents/risk", { equipment_id: equipmentId }),

  anomalies: (useLlm = true) =>
    post("/agents/anomalies", { use_llm_enrichment: useLlm }),

  report: (reportType, equipmentId = "RM-04") =>
    post("/agents/report", { report_type: reportType, equipment_id: equipmentId }),
};

// ── RAG Index ─────────────────────────────────────────────────────────────
export const ragApi = {
  status: () => get("/rag/status"),
  reset: () => post("/rag/reset", {}),
  chunks: (limit = 50) => get(`/rag/chunks?limit=${limit}`),

  // Returns a ReadableStream of SSE events
  buildStream: () => fetch(`${BASE}/rag/build`, { method: "POST" }),
};

// ── Trends & Health ───────────────────────────────────────────────────────
export const trendApi = {
  sensorTrends: (equipmentId) => get(`/plant/trends/${equipmentId}`),
  equipmentHealth: (equipmentId) => get(`/plant/health/${equipmentId}`),
  plantHealth: () => get("/plant/health"),
};

// ── Feedback ──────────────────────────────────────────────────────────────
export const feedbackApi = {
  submit: (agentName, originalQuery, originalResponse, rating, correction = null, equipmentId = null) =>
    post("/agents/feedback", {
      agent_name: agentName,
      original_query: originalQuery,
      original_response: originalResponse,
      rating,
      engineer_correction: correction,
      equipment_id: equipmentId,
    }),
  summary: () => get("/agents/feedback/summary"),
};

// ── Streaming chat ────────────────────────────────────────────────────────
export function streamChat(message, conversationHistory = [], equipmentId = null) {
  return fetch("/api/agents/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversation_history: conversationHistory,
      equipment_id: equipmentId,
      stream: true,
    }),
  });
}

// ── New v5 endpoints ──────────────────────────────────────────────────────
export const monitorApi = {
  scan: (includeLlm = true) => post("/agents/monitor", { include_llm_report: includeLlm }),
};

export const schedulerApi = {
  getSchedule: (crew = 2, shutdownHours = 8, deferList = []) =>
    post("/agents/schedule", {
      available_crew: crew,
      shutdown_window_hours: shutdownHours,
      defer_equipment: deferList,
    }),
};

export const rulApi = {
  equipment: (id) => get(`/plant/rul/${id}`),
  plantSummary: () => get("/plant/rul"),
};

// ── Full Analysis (chained Diagnose → Recommend) ──────────────────────────
export const fullAnalysisApi = {
  run: (equipmentId, query = null) =>
    post("/agents/full_analysis", { equipment_id: equipmentId, query }),
  emergency: () =>
    post("/agents/emergency_actions", {}),
};

// ── WebSocket — real-time sensor updates ──────────────────────────────────
export function createSensorWebSocket(onMessage, onCriticalAlert) {
  const ws = new WebSocket("ws://localhost:8000/ws/sensors");

  ws.onopen = () => console.log("WS: sensor feed connected");

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "CRITICAL_ALERT" && onCriticalAlert) {
        onCriticalAlert(data);
      }
      if (onMessage) onMessage(data);
    } catch (e) {}
  };

  ws.onerror = () => console.warn("WS: sensor feed error");
  ws.onclose = () => {
    console.log("WS: sensor feed closed — reconnecting in 5s");
    setTimeout(() => createSensorWebSocket(onMessage, onCriticalAlert), 5000);
  };

  return ws;
}
