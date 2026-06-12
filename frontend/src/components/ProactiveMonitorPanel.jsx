import { useState, useEffect } from "react";
import { monitorApi } from "../utils/api.js";
import { COLORS, Markdown, SectionLabel, Spinner, ErrorBox, Dot } from "../utils/ui.jsx";

const SEV_COLOR = {
  critical: { bg: "#450a0a", border: "#ef4444", text: "#fca5a5", dot: "#ef4444" },
  high:     { bg: "#431407", border: "#f97316", text: "#fdba74", dot: "#f97316" },
  medium:   { bg: "#422006", border: "#f59e0b", text: "#fcd34d", dot: "#f59e0b" },
  low:      { bg: "#052e16", border: "#22c55e", text: "#86efac", dot: "#22c55e" },
};

const TIMING_COLOR = {
  IMMEDIATE: "#ef4444",
  URGENT:    "#f97316",
  PLANNED:   "#f59e0b",
  SCHEDULED: "#22c55e",
};

function GanttBar({ item }) {
  const color = TIMING_COLOR[item.timing] || "#4a5568";
  const widthPct = Math.min(100, (item.hours / 12) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <span style={{ width: 52, fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace", flexShrink: 0 }}>
        {item.id}
      </span>
      <div style={{ flex: 1, height: 20, background: "#1e2938", borderRadius: 4, overflow: "hidden", position: "relative" }}>
        <div style={{ height: "100%", width: `${widthPct}%`, background: color, borderRadius: 4, display: "flex", alignItems: "center", paddingLeft: 6, minWidth: 40 }}>
          <span style={{ fontSize: 10, color: "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>{item.hours}h</span>
        </div>
      </div>
      <span style={{ fontSize: 10, color, fontFamily: "monospace", flexShrink: 0, width: 70 }}>{item.timing}</span>
    </div>
  );
}

export default function ProactiveMonitorPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastScan, setLastScan] = useState(null);

  async function runScan() {
    setLoading(true);
    setError(null);
    try {
      const result = await monitorApi.scan(true);
      setData(result);
      setLastScan(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { runScan(); }, []);

  return (
    <div style={{ padding: 24, fontFamily: "'IBM Plex Sans', sans-serif", overflowY: "auto", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 600, margin: 0 }}>Proactive Monitoring</h2>
          <p style={{ color: COLORS.textMuted, fontSize: 13, margin: "4px 0 0" }}>
            Autonomous plant-wide scan — detects emerging failures without being asked.
            {lastScan && <span style={{ marginLeft: 8, fontFamily: "monospace", fontSize: 11 }}>Last scan: {lastScan.toLocaleTimeString("en-IN")}</span>}
          </p>
        </div>
        <button onClick={runScan} disabled={loading}
          style={{ padding: "8px 16px", background: loading ? "#1e2938" : "#1d4ed8", border: "none", borderRadius: 6, color: loading ? COLORS.textMuted : "#fff", fontSize: 13, cursor: loading ? "not-allowed" : "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
          <i className={`ti ${loading ? "ti-loader" : "ti-radar"}`} style={{ fontSize: 14 }} />
          {loading ? "Scanning..." : "Run Scan"}
        </button>
      </div>

      {loading && !data && <div style={{ padding: 40 }}><Spinner label="Running autonomous plant scan..." /></div>}
      {error && <ErrorBox message={error} />}

      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Business Impact */}
          <div style={{ gridColumn: "1 / -1", padding: 16, background: data.critical_count > 0 ? "#2a0a0a" : "#052e16", border: `1px solid ${data.critical_count > 0 ? "#7f1d1d" : "#166534"}`, borderRadius: 8, display: "flex", gap: 20, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: data.critical_count > 0 ? "#ef4444" : "#22c55e", fontFamily: "monospace" }}>
                {data.total_warnings}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted }}>Warnings Detected</div>
            </div>
            <div style={{ width: 1, height: 50, background: COLORS.border }} />
            <div style={{ flex: 1, display: "flex", gap: 20, flexWrap: "wrap" }}>
              {[
                { label: "Critical", value: data.critical_count, color: "#ef4444" },
                { label: "Correlations", value: data.correlations?.length || 0, color: "#f97316" },
                { label: "Priority Actions", value: data.priority_actions?.length || 0, color: "#f59e0b" },
                { label: "Financial Exposure", value: data.business_impact?.cost_display, color: "#60a5fa" },
                { label: "Intervention Saves", value: data.business_impact?.intervention_saves, color: "#4ade80" },
              ].map(k => (
                <div key={k.label}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: k.color, fontFamily: "monospace" }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: COLORS.textMuted }}>{k.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Early Warnings */}
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16 }}>
            <SectionLabel>Early Warnings ({data.early_warnings?.length || 0})</SectionLabel>
            {!data.early_warnings?.length && <p style={{ fontSize: 12, color: COLORS.textMuted }}>No early warnings detected.</p>}
            {(data.early_warnings || []).map((w, i) => {
              const pal = SEV_COLOR[w.severity] || SEV_COLOR.low;
              return (
                <div key={i} style={{ padding: "9px 10px", marginBottom: 7, background: pal.bg, border: `1px solid ${pal.border}`, borderRadius: 6 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                    <Dot color={pal.dot} glow={w.severity === "high"} />
                    <span style={{ fontSize: 11, color: pal.text, fontWeight: 600 }}>{w.equipment_id}</span>
                    <span style={{ fontSize: 10, color: COLORS.textMuted }}>· {w.type}</span>
                    {w.proactive && <span style={{ fontSize: 9, background: "#1a2540", color: "#60a5fa", padding: "1px 5px", borderRadius: 3 }}>PROACTIVE</span>}
                  </div>
                  <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0, lineHeight: 1.5 }}>{w.message}</p>
                  {w.hours_to_threshold && (
                    <div style={{ fontSize: 10, color: "#f97316", marginTop: 4, fontFamily: "monospace" }}>
                      ⏱ {w.hours_to_threshold}h to threshold
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cross-Equipment Correlations */}
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16 }}>
            <SectionLabel>Cross-Equipment Correlations ({data.correlations?.length || 0})</SectionLabel>
            {!data.correlations?.length && <p style={{ fontSize: 12, color: COLORS.textMuted }}>No correlations detected.</p>}
            {(data.correlations || []).map((c, i) => {
              const pal = SEV_COLOR[c.severity] || SEV_COLOR.medium;
              return (
                <div key={i} style={{ padding: "9px 10px", marginBottom: 7, background: pal.bg, border: `1px solid ${pal.border}`, borderRadius: 6 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                    <Dot color={pal.dot} />
                    <span style={{ fontSize: 11, color: pal.text, fontWeight: 600 }}>{c.type.replace(/_/g, " ")}</span>
                    {c.historical_precedent && (
                      <span style={{ fontSize: 9, background: "#431407", color: "#fdba74", padding: "1px 5px", borderRadius: 3 }}>
                        {c.historical_precedent}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0, lineHeight: 1.5 }}>{c.message}</p>
                </div>
              );
            })}
          </div>

          {/* Priority Actions */}
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16 }}>
            <SectionLabel>Priority Actions</SectionLabel>
            {(data.priority_actions || []).map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 10px", marginBottom: 6, background: "#111827", borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: TIMING_COLOR[a.urgency?.split(" ")[0]] || "#4a5568", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>{a.priority}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: TIMING_COLOR[a.urgency?.split(" ")[0]] || COLORS.textMuted, fontFamily: "monospace", fontWeight: 600, marginBottom: 2 }}>{a.urgency}</div>
                  <div style={{ fontSize: 12, color: COLORS.textDim }}>{a.action?.slice(0, 100)}</div>
                </div>
                <div style={{ fontSize: 10, color: COLORS.textMuted, whiteSpace: "nowrap" }}>{a.estimated_time}</div>
              </div>
            ))}
          </div>

          {/* Situation Report */}
          {data.situation_report && (
            <div style={{ gridColumn: "1 / -1", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16 }}>
              <SectionLabel>AI Situation Report</SectionLabel>
              <Markdown text={data.situation_report} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
