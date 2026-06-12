import { useState, useEffect } from "react";
import { plantApi, agentApi } from "../utils/api.js";
import { PlantHealthOverview } from "./HealthScoreCard.jsx";
import EmergencyActions from "./EmergencyActions.jsx";
import { COLORS, RISK_PALETTE, SEV_PALETTE, Dot, SectionLabel, Spinner, ErrorBox } from "../utils/ui.jsx";

export default function Dashboard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [liveSensors, setLiveSensors] = useState({});
  const [wsConnected, setWsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    function fetchData(isInitial = false) {
      if (isInitial) setLoading(true);
      Promise.all([plantApi.dashboard(), agentApi.anomalies(false)])
        .then(([dash, anom]) => {
          if (cancelled) return;
          setData(dash);
          setAnomalies(anom.anomalies || []);
          setError(null);
        })
        .catch(e => { if (!cancelled) setError(e.message); })
        .finally(() => { if (isInitial && !cancelled) setLoading(false); });
    }

    fetchData(true);
    const interval = setInterval(() => fetchData(false), 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (loading) return <div style={{ padding: 40 }}><Spinner label="Loading plant data..." /></div>;
  if (error) return <div style={{ padding: 40 }}><ErrorBox message={error} /></div>;

  const kpis = [
    { label: "Equipment Monitored", value: data.total_equipment,          icon: "ti-settings-2",    color: "#3b82f6" },
    { label: "Unacknowledged Alerts", value: data.unacknowledged_alerts,  icon: "ti-bell-ringing",  color: "#ef4444" },
    { label: "High-Risk Equipment",  value: data.high_risk_equipment,     icon: "ti-alert-triangle",color: "#f97316" },
    { label: "Low Stock Spares",     value: data.low_stock_spares,        icon: "ti-package",       color: "#f59e0b" },
  ];

  return (
    <div style={{ padding: 24, fontFamily: "'IBM Plex Sans', sans-serif", overflowY: "auto", height: "100%" }}>
      {/* Banner */}
      <div style={{ padding: "14px 20px", marginBottom: 20, background: "linear-gradient(135deg,#0f172a,#1e3a5f)", border: "1px solid #2a3a52", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ color: COLORS.text, fontSize: 17, fontWeight: 600 }}>Maintenance Wizard — Jamshedpur Plant</h1>
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 3, fontFamily: "monospace" }}>AI-powered maintenance decision support · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 11, color: wsConnected ? "#4ade80" : "#64748b", fontFamily: "monospace", display: "flex", gap: 5, alignItems: "center" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: wsConnected ? "#22c55e" : "#4a5568", boxShadow: wsConnected ? "0 0 6px #22c55e" : "none" }} />
            {wsConnected ? "Live Feed Active" : "Connecting..."}
          </div>
        </div>
        {anomalies.length > 0 && (
          <div style={{ padding: "6px 12px", background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 6, fontSize: 12, color: "#fca5a5" }}>
            <i className="ti ti-alert-triangle" style={{ marginRight: 5 }} />{anomalies.length} sensor anomalies detected
          </div>
        )}
      </div>

      {/* Emergency Actions */}
      <div style={{ marginBottom: 20, padding: 16, background: "#0d1117", border: "1px solid #1e2938", borderRadius: 8 }}>
        <div style={{ fontSize: 10, color: "#4a5568", marginBottom: 10, letterSpacing: "0.08em" }}>SHIFT INTELLIGENCE — WHAT NEEDS ATTENTION NOW?</div>
        <EmergencyActions />
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ padding: "14px 16px", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>{k.label}</span>
              <i className={`ti ${k.icon}`} style={{ fontSize: 15, color: k.color }} />
            </div>
            <div style={{ fontSize: 30, fontWeight: 600, color: k.color, fontFamily: "monospace" }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Equipment status */}
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16 }}>
          <SectionLabel>Equipment Status</SectionLabel>
          {data.equipment_status.map(eq => {
            const hasAlert = eq.unack_alert_count > 0;
            const riskColor = hasAlert ? SEV_PALETTE.high : eq.has_warning_sensor ? SEV_PALETTE.medium : SEV_PALETTE.low;
            return (
              <div key={eq.id} onClick={() => onNavigate("equipment", eq.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", marginBottom: 5, background: COLORS.surface2, borderRadius: 6, border: `1px solid ${hasAlert ? riskColor.border : COLORS.border}`, cursor: "pointer" }}>
                <Dot color={hasAlert ? riskColor.dot : eq.has_warning_sensor ? "#f59e0b" : "#22c55e"} glow={hasAlert} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 500 }}>{eq.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace" }}>{eq.id} · {eq.location?.split(" - ")[1]}</div>
                </div>
                {eq.unack_alert_count > 0 && <span style={{ background: "#7f1d1d", color: "#fca5a5", fontSize: 10, padding: "1px 6px", borderRadius: 10 }}>{eq.unack_alert_count}</span>}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Anomalies */}
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16, flex: 1 }}>
            <SectionLabel>Live Sensor Anomalies ({anomalies.length})</SectionLabel>
            {anomalies.length === 0
              ? <p style={{ fontSize: 12, color: COLORS.textMuted }}>All sensors within normal ranges.</p>
              : anomalies.map((a, i) => {
                const pal = SEV_PALETTE[a.severity] || SEV_PALETTE.low;
                return (
                  <div key={i} style={{ padding: "9px 10px", marginBottom: 6, background: pal.bg, border: `1px solid ${pal.border}`, borderRadius: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <Dot color={pal.dot} />
                      <span style={{ fontSize: 11, color: pal.text, fontFamily: "monospace", fontWeight: 600 }}>{a.equipment_id} · {a.parameter}</span>
                      <span style={{ fontSize: 10, color: pal.text, marginLeft: "auto" }}>{a.current_value} {a.unit} {a.trend === "rising" ? "↑" : a.trend === "falling" ? "↓" : ""}</span>
                    </div>
                    <p style={{ fontSize: 11, color: COLORS.textDim, margin: 0 }}>{a.recommended_action}</p>
                  </div>
                );
              })}
          </div>

          {/* Plant health overview */}
          <PlantHealthOverview onSelectEquipment={(id) => onNavigate("equipment", id)} />

          {/* Quick actions */}
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16 }}>
            <SectionLabel>Quick Actions</SectionLabel>
            {[
              { label: "Diagnose Rolling Mill #4 Bearing Fault", view: "chat",      icon: "ti-robot",        color: "#f97316" },
              { label: "View Equipment Health & Risk Scores",    view: "equipment",  icon: "ti-activity",     color: "#3b82f6" },
              { label: "Generate Shift Handover Report",         view: "reports",    icon: "ti-file-report",  color: "#22c55e" },
              { label: "Manage RAG Knowledge Index",             view: "rag",        icon: "ti-vector",       color: "#a78bfa" },
            ].map(qa => (
              <button key={qa.label} onClick={() => onNavigate(qa.view)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", marginBottom: 5, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: "pointer", color: COLORS.text, fontSize: 13, textAlign: "left" }}>
                <i className={`ti ${qa.icon}`} style={{ fontSize: 14, color: qa.color }} />
                {qa.label}
                <i className="ti ti-arrow-right" style={{ marginLeft: "auto", fontSize: 12, color: COLORS.textMuted }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Low stock spares */}
      {data.low_stock_spares_list?.length > 0 && (
        <div style={{ marginTop: 16, background: COLORS.surface, border: "1px solid #78350f", borderRadius: 8, padding: 16 }}>
          <SectionLabel>⚠ Low Stock Spare Parts</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
            {data.low_stock_spares_list.map(s => (
              <div key={s.id} style={{ padding: "10px 12px", background: "#2a1200", border: "1px solid #78350f", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace" }}>Lead time: {s.lead_time}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#ef4444", fontFamily: "monospace" }}>{s.qty}</div>
                  <div style={{ fontSize: 10, color: "#f97316" }}>min: {s.min_stock}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
