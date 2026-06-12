import { useState, useEffect, useRef } from "react";
import Dashboard from "./components/Dashboard.jsx";
import ChatInterface from "./components/ChatInterface.jsx";
import EquipmentPanel from "./components/EquipmentPanel.jsx";
import AlertsPanel from "./components/AlertsPanel.jsx";
import ReportsPanel from "./components/ReportsPanel.jsx";
import RAGIndexPanel from "./components/RAGIndexPanel.jsx";
import FeedbackDashboard from "./components/FeedbackDashboard.jsx";
import ProactiveMonitorPanel from "./components/ProactiveMonitorPanel.jsx";
import SchedulerPanel from "./components/SchedulerPanel.jsx";
import RULPanel from "./components/RULPanel.jsx";
import { ragApi, createSensorWebSocket } from "./utils/api.js";
import ToastContainer, { toast, sendBrowserNotification } from "./components/ToastContainer.jsx";
import FullAnalysisPanel from "./components/FullAnalysisPanel.jsx";
import { COLORS } from "./utils/ui.jsx";

const NAV = [
  { id: "dashboard",  label: "Dashboard",          icon: "ti-layout-dashboard" },
  { id: "chat",       label: "Maintenance Wizard",  icon: "ti-robot" },
  { id: "equipment",  label: "Equipment Health",    icon: "ti-settings-2" },
  { id: "alerts",     label: "Alerts",              icon: "ti-bell-ringing" },
  { id: "reports",    label: "Reports",             icon: "ti-file-report" },
  { id: "rag",        label: "RAG Index",           icon: "ti-vector" },
  { id: "feedback",   label: "Feedback",             icon: "ti-thumb-up" },
  { id: "monitor",    label: "Proactive Monitor",    icon: "ti-radar" },
  { id: "scheduler",  label: "Maintenance Schedule", icon: "ti-calendar-event" },
  { id: "rul",        label: "RUL Analysis",         icon: "ti-chart-line" },
  { id: "fullanalysis", label: "Full Analysis",         icon: "ti-analyze" },
];

export default function App() {
  const [view, setView] = useState("dashboard");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
  const [ragStatus, setRagStatus] = useState(null);
  const [backendOk, setBackendOk] = useState(null);
  const [unackAlerts, setUnackAlerts] = useState(0);
  const [chatMessages, setChatMessages] = useState(null);

  useEffect(() => {
    // WebSocket real-time alerts for non-dashboard pages
    const ws = createSensorWebSocket(
      null,
      (alert) => {
        toast(`🚨 ${alert.equipment_id}: ${alert.message}`, "critical", 10000);
        sendBrowserNotification("CRITICAL SENSOR ALERT", alert.message, "🚨");
        // Refresh unack alerts count
        fetch("/api/plant/alerts?unacknowledged_only=true")
          .then(r => r.json()).then(d => setUnackAlerts(d.total || 0)).catch(() => {});
      }
    );
    return () => ws && ws.close && ws.close();
  }, []);

  useEffect(() => {
    // Check backend health
    fetch("/health").then(r => r.json()).then(d => {
      setBackendOk(true);
      setRagStatus(d.rag_index);
    }).catch(() => setBackendOk(false));
    // Poll unacknowledged alerts count
    fetch("/api/plant/alerts?unacknowledged_only=true").then(r => r.json()).then(d => setUnackAlerts(d.total || 0)).catch(() => {});
  }, []);

  function navigate(targetView, equipId) {
    setView(targetView);
    if (equipId) setSelectedEquipmentId(equipId);
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: COLORS.bg }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />

      {/* Sidebar */}
      <aside style={{ width: 224, background: COLORS.surface, borderRight: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: "18px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, background: "linear-gradient(135deg,#e85d04,#f48c06)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="ti ti-flame" style={{ color: "#fff", fontSize: 18 }} />
            </div>
            <div>
              <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>MAINTENANCE</div>
              <div style={{ color: "#e85d04", fontSize: 10, fontWeight: 500, letterSpacing: "0.1em" }}>WIZARD · TATA STEEL</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 8px" }}>
          {NAV.map(item => (
            <button key={item.id} onClick={() => setView(item.id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", marginBottom: 2, border: "none", cursor: "pointer", borderRadius: 6, background: view === item.id ? "#1a2540" : "transparent", color: view === item.id ? "#60a5fa" : COLORS.textDim, fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, textAlign: "left", borderLeft: `2px solid ${view === item.id ? "#3b82f6" : "transparent"}`, transition: "all 0.15s" }}>
              <i className={`ti ${item.icon}`} style={{ fontSize: 16 }} />
              {item.label}
              {item.id === "alerts" && unackAlerts > 0 && (
                <span style={{ marginLeft: "auto", background: "#dc2626", color: "#fff", fontSize: 10, borderRadius: 10, padding: "1px 6px", fontWeight: 600 }}>{unackAlerts}</span>
              )}
              {item.id === "rag" && (
                <span style={{ marginLeft: "auto", fontSize: 9, padding: "1px 5px", borderRadius: 3, background: ragStatus?.built ? "#052e16" : "#1e2938", color: ragStatus?.built ? "#4ade80" : COLORS.textMuted, border: `1px solid ${ragStatus?.built ? "#166534" : COLORS.border2}` }}>
                  {ragStatus?.built ? "READY" : "SETUP"}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Backend status */}
        <div style={{ padding: "10px 8px", borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ padding: "7px 10px", borderRadius: 6, background: backendOk ? "#0d2818" : "#2a1515", border: `1px solid ${backendOk ? "#166534" : "#7f1d1d"}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: backendOk ? "#22c55e" : backendOk === false ? "#ef4444" : "#f59e0b" }} />
              <span style={{ fontSize: 11, color: backendOk ? "#4ade80" : backendOk === false ? "#f87171" : "#fcd34d", fontFamily: "monospace" }}>
                {backendOk === null ? "Connecting..." : backendOk ? "Backend Connected" : "Backend Offline"}
              </span>
            </div>
            {backendOk && (
              <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4, fontFamily: "monospace" }}>
                Python FastAPI · localhost:8000
              </div>
            )}
          </div>
          {backendOk === false && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#f87171", lineHeight: 1.5 }}>
              Start backend: <code style={{ background: "#1e2938", padding: "0 4px", borderRadius: 3 }}>uvicorn main:app --reload</code>
            </div>
          )}
        </div>
      </aside>

      {/* Main area */}
      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <header style={{ padding: "11px 20px", background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <span style={{ color: COLORS.textMuted, fontSize: 12 }}>{NAV.find(n => n.id === view)?.label}</span>
            {selectedEquipmentId && <span style={{ color: "#60a5fa", fontSize: 12, marginLeft: 8 }}>› {selectedEquipmentId}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {ragStatus?.built && (
              <div style={{ fontSize: 11, color: "#4ade80", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 5 }}>
                <i className="ti ti-vector" style={{ fontSize: 12 }} />
                RAG: {ragStatus.chunk_count} chunks
              </div>
            )}
            <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace" }}>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · Jamshedpur</span>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {view === "dashboard"  && <Dashboard onNavigate={navigate} />}
          {view === "chat"       && <ChatInterface selectedEquipmentId={selectedEquipmentId} setSelectedEquipmentId={setSelectedEquipmentId} ragStatus={ragStatus} messages={chatMessages} setMessages={setChatMessages} />}
          {view === "equipment"  && <EquipmentPanel selectedEquipmentId={selectedEquipmentId} setSelectedEquipmentId={setSelectedEquipmentId} ragStatus={ragStatus} />}
          {view === "alerts"     && <AlertsPanel />}
          {view === "reports"    && <ReportsPanel ragStatus={ragStatus} />}
          {view === "rag"        && <RAGIndexPanel onIndexReady={() => { ragApi.status().then(setRagStatus); }} />}
          {view === "feedback"   && <FeedbackDashboard />}
          {view === "monitor"    && <ProactiveMonitorPanel />}
          {view === "scheduler"  && <SchedulerPanel />}
          {view === "rul"        && <RULPanel />}
          {view === "fullanalysis" && <FullAnalysisPanel ragStatus={ragStatus} />}
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}
