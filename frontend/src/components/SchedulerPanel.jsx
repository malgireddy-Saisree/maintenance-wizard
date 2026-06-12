import { useState, useEffect } from "react";
import { schedulerApi } from "../utils/api.js";
import { COLORS, SectionLabel, Spinner, ErrorBox, Markdown } from "../utils/ui.jsx";

const TIMING_COLORS = {
  IMMEDIATE: { bg: "#450a0a", border: "#ef4444", text: "#fca5a5", bar: "#ef4444" },
  URGENT:    { bg: "#431407", border: "#f97316", text: "#fdba74", bar: "#f97316" },
  PLANNED:   { bg: "#422006", border: "#f59e0b", text: "#fcd34d", bar: "#f59e0b" },
  SCHEDULED: { bg: "#052e16", border: "#22c55e", text: "#86efac", bar: "#22c55e" },
};

function ScoreBar({ label, value, max = 35, color = "#3b82f6" }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: COLORS.textMuted }}>{label}</span>
        <span style={{ fontSize: 10, color, fontFamily: "monospace" }}>{value.toFixed(1)}</span>
      </div>
      <div style={{ height: 3, background: "#1e2938", borderRadius: 2 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function GanttChart({ schedule }) {
  const immediate = schedule.filter(s => s.timing === "IMMEDIATE");
  const urgent    = schedule.filter(s => s.timing === "URGENT");
  const visible   = [...immediate, ...urgent];
  if (!visible.length) return <p style={{ fontSize: 12, color: COLORS.textMuted }}>No immediate or urgent tasks.</p>;

  const maxHours = Math.max(...visible.map(s => s.estimated_hours), 1);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 8 }}>
        <span style={{ width: 52, fontSize: 10, color: COLORS.textMuted }}>Equipment</span>
        <span style={{ fontSize: 10, color: COLORS.textMuted }}>Timeline (hours)</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          {Object.entries(TIMING_COLORS).slice(0,2).map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <div style={{ width: 8, height: 8, background: v.bar, borderRadius: 2 }} />
              <span style={{ fontSize: 10, color: COLORS.textMuted }}>{k}</span>
            </div>
          ))}
        </div>
      </div>
      {visible.map(item => {
        const pal = TIMING_COLORS[item.timing] || TIMING_COLORS.SCHEDULED;
        const widthPct = (item.estimated_hours / (maxHours * 1.2)) * 100;
        return (
          <div key={item.equipment_id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ width: 52, fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace", flexShrink: 0 }}>
              {item.equipment_id}
            </span>
            <div style={{ flex: 1, position: "relative" }}>
              <div style={{ height: 24, background: "#1e2938", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${widthPct}%`, background: pal.bar,
                  borderRadius: 4, display: "flex", alignItems: "center", paddingLeft: 8,
                  minWidth: 60, transition: "width 0.6s ease",
                }}>
                  <span style={{ fontSize: 11, color: "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {item.estimated_hours}h
                  </span>
                </div>
              </div>
            </div>
            <span style={{ fontSize: 10, color: pal.text, fontFamily: "monospace", width: 80, flexShrink: 0 }}>
              {item.timing}
            </span>
            <span style={{ fontSize: 10, color: COLORS.textMuted, flexShrink: 0 }}>
              ₹{(item.estimated_cost_inr / 1000).toFixed(0)}k
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function SchedulerPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [crew, setCrew] = useState(2);
  const [shutdownHours, setShutdownHours] = useState(8);
  const [expandedEquip, setExpandedEquip] = useState(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const result = await schedulerApi.getSchedule(crew, shutdownHours);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { generate(); }, []);

  return (
    <div style={{ padding: 24, fontFamily: "'IBM Plex Sans', sans-serif", overflowY: "auto", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 600, margin: 0 }}>Maintenance Scheduler</h2>
          <p style={{ color: COLORS.textMuted, fontSize: 13, margin: "4px 0 0" }}>
            AI-optimized maintenance prioritization across all equipment — balances urgency, criticality, crew, and parts availability.
          </p>
        </div>
      </div>

      {/* Constraints */}
      <div style={{ padding: 14, marginBottom: 20, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label style={{ display: "block", fontSize: 11, color: COLORS.textMuted, marginBottom: 5 }}>Available Crew</label>
          <select value={crew} onChange={e => setCrew(Number(e.target.value))}
            style={{ background: "#161c2d", border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, padding: "6px 10px", fontSize: 13 }}>
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} Fitter{n > 1 ? "s" : ""}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, color: COLORS.textMuted, marginBottom: 5 }}>Shutdown Window</label>
          <select value={shutdownHours} onChange={e => setShutdownHours(Number(e.target.value))}
            style={{ background: "#161c2d", border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, padding: "6px 10px", fontSize: 13 }}>
            {[4,6,8,12,16,24].map(h => <option key={h} value={h}>{h} hours</option>)}
          </select>
        </div>
        <button onClick={generate} disabled={loading}
          style={{ padding: "7px 18px", background: loading ? "#1e2938" : "#1d4ed8", border: "none", borderRadius: 6, color: loading ? COLORS.textMuted : "#fff", fontSize: 13, cursor: loading ? "not-allowed" : "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
          <i className={`ti ${loading ? "ti-loader" : "ti-calendar-event"}`} style={{ fontSize: 14 }} />
          {loading ? "Scheduling..." : "Generate Schedule"}
        </button>
        {data && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
            {[
              { label: "Total Downtime", value: `${data.total_downtime_hours}h`, color: "#f97316" },
              { label: "Est. Cost",      value: data.cost_display,               color: "#fcd34d" },
              { label: "Immediate",      value: data.immediate_count,             color: "#ef4444" },
              { label: "Urgent",         value: data.urgent_count,               color: "#f97316" },
            ].map(k => (
              <div key={k.label} style={{ textAlign: "right" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: k.color, fontFamily: "monospace" }}>{k.value}</div>
                <div style={{ fontSize: 10, color: COLORS.textMuted }}>{k.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && !data && <Spinner label="Generating optimized schedule..." />}
      {error && <ErrorBox message={error} />}

      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Gantt chart */}
          <div style={{ gridColumn: "1 / -1", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16 }}>
            <SectionLabel>Maintenance Gantt — Immediate & Urgent Tasks</SectionLabel>
            <GanttChart schedule={data.schedule || []} />
          </div>

          {/* Urgency scores */}
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16 }}>
            <SectionLabel>Urgency Score Breakdown</SectionLabel>
            {(data.urgency_scores || []).sort((a,b) => b.urgency_score - a.urgency_score).map(eq => (
              <div key={eq.equipment_id}>
                <div
                  onClick={() => setExpandedEquip(expandedEquip === eq.equipment_id ? null : eq.equipment_id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer", borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontSize: 12, color: COLORS.text, fontWeight: 500, width: 52, fontFamily: "monospace" }}>{eq.equipment_id}</span>
                  <div style={{ flex: 1, height: 6, background: "#1e2938", borderRadius: 3 }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      width: `${eq.urgency_score}%`,
                      background: eq.urgency_score >= 75 ? "#ef4444" : eq.urgency_score >= 50 ? "#f97316" : eq.urgency_score >= 30 ? "#f59e0b" : "#22c55e",
                      transition: "width 0.6s ease",
                    }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, fontFamily: "monospace", width: 36, textAlign: "right" }}>
                    {eq.urgency_score.toFixed(0)}
                  </span>
                  <i className={`ti ti-chevron-${expandedEquip === eq.equipment_id ? "up" : "down"}`} style={{ fontSize: 12, color: COLORS.textMuted }} />
                </div>
                {expandedEquip === eq.equipment_id && (
                  <div style={{ padding: "10px 0 6px 60px" }}>
                    <ScoreBar label="Severity"     value={eq.components.severity_component}    max={35} color="#ef4444" />
                    <ScoreBar label="Criticality"  value={eq.components.criticality_component} max={25} color="#f97316" />
                    <ScoreBar label="Trend"        value={eq.components.trend_component}       max={20} color="#f59e0b" />
                    <ScoreBar label="Spares"       value={eq.components.spares_component}      max={10} color="#60a5fa" />
                    <ScoreBar label="Overdue"      value={eq.components.overdue_component}     max={10} color="#a78bfa" />
                    {eq.low_spares?.length > 0 && (
                      <div style={{ fontSize: 11, color: "#f97316", marginTop: 6 }}>
                        ⚠ Low stock: {eq.low_spares.join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Schedule list */}
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16 }}>
            <SectionLabel>Ranked Schedule ({data.schedule?.length || 0} tasks)</SectionLabel>
            {(data.schedule || []).map(item => {
              const pal = TIMING_COLORS[item.timing] || TIMING_COLORS.SCHEDULED;
              return (
                <div key={item.equipment_id} style={{ padding: "10px 12px", marginBottom: 8, background: pal.bg, border: `1px solid ${pal.border}`, borderRadius: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: pal.bar, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
                      {item.rank}
                    </span>
                    <span style={{ fontSize: 13, color: COLORS.text, fontWeight: 600 }}>{item.equipment_name}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: pal.text, fontFamily: "monospace", fontWeight: 600 }}>{item.timing}</span>
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span>Score: <strong style={{ color: COLORS.text }}>{item.urgency_score}</strong></span>
                    <span>Est: <strong style={{ color: COLORS.text }}>{item.estimated_hours}h</strong></span>
                    <span>Crew: <strong style={{ color: COLORS.text }}>{item.crew_required}</strong></span>
                    <span>Cost: <strong style={{ color: COLORS.text }}>₹{(item.estimated_cost_inr/1000).toFixed(0)}k</strong></span>
                    <span style={{ color: "#60a5fa" }}>{item.window}</span>
                  </div>
                  {item.rationale && (
                    <div style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: 28, marginTop: 4, fontStyle: "italic" }}>
                      {item.rationale}
                    </div>
                  )}
                  {item.low_spares?.length > 0 && (
                    <div style={{ fontSize: 11, color: "#f97316", marginLeft: 28, marginTop: 4 }}>
                      ⚠ Low stock: {item.low_spares.join(", ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* LLM rationale */}
          {data.rationale && (
            <div style={{ gridColumn: "1 / -1", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16 }}>
              <SectionLabel>AI Scheduling Rationale</SectionLabel>
              <Markdown text={data.rationale} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
