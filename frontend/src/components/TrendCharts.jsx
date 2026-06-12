import { useState, useEffect } from "react";
import { trendApi } from "../utils/api.js";
import { COLORS } from "../utils/ui.jsx";

function Sparkline({ data, color, width = 200, height = 50, threshold = null, thresholdDir = "upper" }) {
  if (!data || data.length === 0) return null;
  const values = data.map(d => d.value);
  const min = Math.min(...values) * 0.98;
  const max = Math.max(...values) * 1.02;
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.value - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  let thresholdY = null;
  if (threshold !== null) {
    thresholdY = height - ((threshold - min) / range) * height;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ overflow: "visible" }}>
      {/* Area fill */}
      <polygon points={areaPoints} fill={`${color}18`} />
      {/* Line */}
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      {/* Threshold line */}
      {thresholdY !== null && (
        <line x1={0} y1={thresholdY} x2={width} y2={thresholdY}
          stroke="#ef4444" strokeWidth="1" strokeDasharray="4,3" opacity={0.7} />
      )}
      {/* Current value dot */}
      {data.length > 0 && (() => {
        const last = data[data.length - 1];
        const x = width;
        const y = height - ((last.value - min) / range) * height;
        return <circle cx={x} cy={y} r="3" fill={color} />;
      })()}
    </svg>
  );
}

export default function TrendCharts({ equipmentId }) {
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!equipmentId) return;
    setLoading(true);
    trendApi.sensorTrends(equipmentId)
      .then(d => setTrends(d.trends))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [equipmentId]);

  if (loading) return (
    <div style={{ padding: 12, color: COLORS.textMuted, fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
      <i className="ti ti-loader" style={{ fontSize: 14, color: COLORS.accent }} /> Loading trend data...
    </div>
  );
  if (error || !trends) return null;

  const statusColor = (s) => s === "critical" ? "#ef4444" : s === "warning" ? "#f97316" : "#22c55e";

  return (
    <div>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 10, letterSpacing: "0.08em" }}>
        24-HOUR SENSOR TRENDS
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 10 }}>
        {Object.entries(trends).map(([param, data]) => {
          const col = statusColor(data.status);
          const isExpanded = expanded === param;
          return (
            <div key={param}
              onClick={() => setExpanded(isExpanded ? null : param)}
              style={{ padding: 10, background: COLORS.surface, border: `1px solid ${data.status !== "normal" ? col : COLORS.border}`, borderRadius: 8, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {param.replace(/_/g, " ")}
                </span>
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  {data.trend_direction === "rising" && <span style={{ color: "#f97316", fontSize: 12 }}>↑</span>}
                  {data.trend_direction === "falling" && <span style={{ color: "#60a5fa", fontSize: 12 }}>↓</span>}
                  <span style={{ fontSize: 12, fontWeight: 600, color: col, fontFamily: "monospace" }}>
                    {data.current} {data.unit}
                  </span>
                </div>
              </div>
              <Sparkline
                data={data.history}
                color={col}
                height={isExpanded ? 70 : 40}
                threshold={data.time_to_threshold ? data.time_to_threshold.threshold : null}
              />
              {data.time_to_threshold && (
                <div style={{ fontSize: 10, color: "#f97316", marginTop: 4, fontFamily: "monospace" }}>
                  ⚠ {data.time_to_threshold.label}
                </div>
              )}
              {isExpanded && (
                <div style={{ marginTop: 8, fontSize: 10, color: COLORS.textMuted, fontFamily: "monospace" }}>
                  <div>Rate: {data.trend_rate_per_hour > 0 ? "+" : ""}{data.trend_rate_per_hour}/hr</div>
                  <div>Range: {data.normal_range[0]}–{data.normal_range[1]} {data.unit}</div>
                  <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between", fontSize: 9 }}>
                    <span>{data.history[0]?.label}</span>
                    <span>now</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
