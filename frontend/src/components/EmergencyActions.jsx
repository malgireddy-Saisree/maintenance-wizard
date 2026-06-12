import { useState } from "react";
import { fullAnalysisApi } from "../utils/api.js";
import { COLORS, Spinner, ErrorBox } from "../utils/ui.jsx";

export default function EmergencyActions({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function runEmergency() {
    setLoading(true);
    setError(null);
    try {
      const result = await fullAnalysisApi.emergency();
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const URGENCY_STYLE = {
    "IMMEDIATE":       { bg: "#450a0a", border: "#ef4444", text: "#fca5a5", badge: "#ef4444" },
    "WITHIN 4 HOURS":  { bg: "#431407", border: "#f97316", text: "#fdba74", badge: "#f97316" },
    "WITHIN 24 HOURS": { bg: "#422006", border: "#f59e0b", text: "#fcd34d", badge: "#f59e0b" },
  };

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Big red button */}
      {!data && !loading && (
        <button onClick={runEmergency}
          style={{
            width: "100%", padding: "14px 20px",
            background: "linear-gradient(135deg, #7f1d1d, #dc2626)",
            border: "1px solid #ef4444", borderRadius: 8, cursor: "pointer",
            color: "#fff", fontSize: 15, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            boxShadow: "0 0 20px rgba(239,68,68,0.3)",
          }}>
          <i className="ti ti-urgent" style={{ fontSize: 20 }} />
          What Do I Do RIGHT NOW?
        </button>
      )}

      {loading && (
        <div style={{ padding: "20px 0" }}>
          <Spinner label="Scanning all equipment simultaneously..." />
        </div>
      )}

      {error && <ErrorBox message={error} />}

      {data && !loading && (
        <div>
          {/* Stats row */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { label: "Anomalies", value: data.anomaly_count, color: "#ef4444" },
              { label: "Critical RUL", value: data.critical_rul_count, color: "#f97316" },
              { label: "Financial Risk", value: data.business_impact?.cost_display, color: "#fcd34d" },
            ].map(k => (
              <div key={k.label} style={{ padding: "6px 12px", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: k.color, fontFamily: "monospace" }}>{k.value}</div>
                <div style={{ fontSize: 10, color: COLORS.textMuted }}>{k.label}</div>
              </div>
            ))}
            <button onClick={runEmergency}
              style={{ marginLeft: "auto", padding: "6px 12px", background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.textMuted, fontSize: 11, cursor: "pointer" }}>
              <i className="ti ti-refresh" style={{ fontSize: 12 }} /> Rescan
            </button>
          </div>

          {/* Top 3 actions */}
          {(data.top_actions || []).map((action, i) => {
            const sty = URGENCY_STYLE[action.urgency] || URGENCY_STYLE["WITHIN 24 HOURS"];
            return (
              <div key={i} style={{ padding: "12px 14px", marginBottom: 8, background: sty.bg, border: `1px solid ${sty.border}`, borderRadius: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: sty.badge, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>{action.rank}</span>
                  </div>
                  <span style={{ fontSize: 11, color: sty.text, fontFamily: "monospace", fontWeight: 700 }}>{action.urgency}</span>
                  <span style={{ fontSize: 12, color: "#60a5fa", marginLeft: 4 }}>{action.equipment_id}</span>
                </div>
                <p style={{ fontSize: 13, color: "#c8d0e0", margin: "0 0 6px", lineHeight: 1.6 }}>{action.action?.slice(0, 150)}</p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: COLORS.textMuted }}>{action.why}</span>
                  <span style={{ fontSize: 11, color: "#f97316", fontFamily: "monospace", marginLeft: "auto" }}>
                    If ignored: {action.cost_if_ignored}
                  </span>
                </div>
              </div>
            );
          })}

          {data.top_actions?.length === 0 && (
            <div style={{ padding: "12px 14px", background: "#052e16", border: "1px solid #166534", borderRadius: 8, fontSize: 13, color: "#86efac" }}>
              <i className="ti ti-circle-check" style={{ marginRight: 8 }} />
              All systems operating within normal parameters. No immediate action required.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
