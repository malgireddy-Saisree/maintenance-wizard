import { useState, useEffect } from "react";
import { rulApi } from "../utils/api.js";
import { COLORS, SectionLabel, Spinner, ErrorBox } from "../utils/ui.jsx";

function RULGauge({ healthPct, size = 70 }) {
  const color = healthPct >= 70 ? "#22c55e" : healthPct >= 40 ? "#f59e0b" : "#ef4444";
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (healthPct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e2938" strokeWidth={7} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{ transform: `rotate(90deg)`, fill: color, fontSize: size * 0.22,
          fontFamily: "monospace", fontWeight: 700,
          transformOrigin: `${size/2}px ${size/2}px` }}>
        {Math.round(healthPct)}%
      </text>
    </svg>
  );
}

export default function RULPanel() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    rulApi.plantSummary()
      .then(setSummary)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40 }}><Spinner label="Computing RUL from AI4I statistics..." /></div>;
  if (error) return <div style={{ padding: 24 }}><ErrorBox message={error} /></div>;
  if (!summary) return null;

  const { equipment_rul = [], critical_count, data_source } = summary;

  return (
    <div style={{ padding: 24, fontFamily: "'IBM Plex Sans', sans-serif", overflowY: "auto", height: "100%" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 600, margin: 0 }}>
          Remaining Useful Life (RUL)
        </h2>
        <p style={{ color: COLORS.textMuted, fontSize: 13, margin: "4px 0 0" }}>
          Formula-based RUL using TB-2024-12 methodology, grounded in real industrial failure statistics.
        </p>
        <div style={{ marginTop: 8, padding: "6px 12px", background: "#1a2540", border: "1px solid #2a3a52", borderRadius: 5, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <i className="ti ti-database" style={{ fontSize: 12, color: "#60a5fa" }} />
          <span style={{ fontSize: 11, color: "#8892a4", fontFamily: "monospace" }}>{data_source}</span>
        </div>
      </div>

      {/* Critical banner */}
      {critical_count > 0 && (
        <div style={{ padding: "10px 16px", marginBottom: 20, background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 18, color: "#ef4444" }} />
          <div>
            <div style={{ fontSize: 13, color: "#fca5a5", fontWeight: 600 }}>
              {critical_count} equipment with RUL &lt; 24 hours — immediate action required
            </div>
            <div style={{ fontSize: 12, color: "#f87171" }}>
              {summary.critical_equipment?.join(", ")}
            </div>
          </div>
        </div>
      )}

      {/* Equipment RUL cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 14 }}>
        {equipment_rul.map(item => {
          const isCritical = item.rul_hours !== null && item.rul_hours < 24;
          const isWarning = item.rul_hours !== null && item.rul_hours < 72;
          const borderColor = isCritical ? "#ef4444" : isWarning ? "#f97316" : COLORS.border;
          const bgColor = isCritical ? "#2a0a0a" : isWarning ? "#1a0f00" : COLORS.surface;

          return (
            <div key={item.equipment_id} style={{ padding: 16, background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 8 }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 12 }}>
                <RULGauge healthPct={item.health_pct} size={66} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 600, marginBottom: 2 }}>{item.equipment_name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace" }}>{item.equipment_id} · {item.failure_mode.replace(/_/g," ")}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: isCritical ? "#ef4444" : isWarning ? "#f97316" : "#22c55e", fontFamily: "monospace", marginTop: 6 }}>
                    {item.rul_display}
                  </div>
                </div>
              </div>

              {/* Key parameter */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div style={{ padding: "6px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 5 }}>
                  <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 }}>Key Parameter</div>
                  <div style={{ fontSize: 12, color: COLORS.text, fontFamily: "monospace" }}>{item.key_parameter.replace(/_/g," ")}</div>
                </div>
                <div style={{ padding: "6px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 5 }}>
                  <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 }}>Current vs Critical</div>
                  <div style={{ fontSize: 12, color: isCritical ? "#ef4444" : "#c8d0e0", fontFamily: "monospace" }}>
                    {item.current_value} → {item.critical_value}
                  </div>
                </div>
                <div style={{ padding: "6px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 5 }}>
                  <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 }}>Method</div>
                  <div style={{ fontSize: 11, color: "#8892a4" }}>{item.method}</div>
                </div>
                <div style={{ padding: "6px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 5 }}>
                  <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 }}>Confidence</div>
                  <div style={{ fontSize: 12, color: item.confidence === "High" ? "#22c55e" : item.confidence === "Medium" ? "#f59e0b" : "#8892a4", fontFamily: "monospace" }}>
                    {item.confidence}
                  </div>
                </div>
              </div>

              {/* AI4I grounding */}
              <div style={{ padding: "7px 10px", background: "#111827", border: "1px solid #1e2938", borderRadius: 5, marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: "#60a5fa", marginBottom: 3, display: "flex", gap: 5, alignItems: "center" }}>
                  <i className="ti ti-database" style={{ fontSize: 11 }} />
                  AI4I 2020 Data Grounding
                </div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>{item.ai4i_context}</div>
              </div>

              {/* Recommendation */}
              <div style={{ padding: "7px 10px", background: isCritical ? "#450a0a" : "#052e16", border: `1px solid ${isCritical ? "#7f1d1d" : "#166534"}`, borderRadius: 5 }}>
                <div style={{ fontSize: 10, color: isCritical ? "#fca5a5" : "#4ade80", fontWeight: 600, marginBottom: 2 }}>
                  {isCritical ? "⚠ IMMEDIATE ACTION" : "✓ RECOMMENDATION"}
                </div>
                <div style={{ fontSize: 12, color: "#c8d0e0" }}>{item.recommendation}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI4I stats footnote */}
      <div style={{ marginTop: 20, padding: "10px 14px", background: "#111827", border: `1px solid ${COLORS.border}`, borderRadius: 6 }}>
        <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.7 }}>
          <strong style={{ color: "#60a5fa" }}>Data Source:</strong> {data_source} · License: CC BY 4.0 ·
          Failure rate: 3.39% (339/10,000) · Avg tool wear at failure: 203 min ·
          Heat dissipation failures: 115 cases · Overstrain failures: 98 cases
        </div>
      </div>
    </div>
  );
}
