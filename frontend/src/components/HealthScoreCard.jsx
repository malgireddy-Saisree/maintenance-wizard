import { useState, useEffect } from "react";
import { trendApi } from "../utils/api.js";
import { COLORS } from "../utils/ui.jsx";

// Circular progress gauge
function CircularGauge({ score, size = 80, strokeWidth = 8 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const color = score >= 85 ? "#22c55e" : score >= 65 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      {/* Background ring */}
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="#1e2938" strokeWidth={strokeWidth} />
      {/* Score arc */}
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${filled} ${circumference}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }} />
      {/* Score text — counter-rotate so it reads correctly */}
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        style={{ transform: `rotate(90deg) translate(0px, -${size}px)`, fill: color, fontSize: size * 0.22, fontFamily: "monospace", fontWeight: 600, transformOrigin: `${size / 2}px ${size / 2}px` }}>
        {Math.round(score)}
      </text>
    </svg>
  );
}

// Mini inline gauge for lists
export function MiniHealthBar({ score, width = 80 }) {
  const color = score >= 85 ? "#22c55e" : score >= 65 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width, height: 4, background: "#1e2938", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontSize: 11, color, fontFamily: "monospace", fontWeight: 600 }}>{Math.round(score)}</span>
    </div>
  );
}

export function PlantHealthOverview({ onSelectEquipment }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trendApi.plantHealth()
      .then(setHealth)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !health) return null;

  const plantColor = health.plant_health_score >= 85 ? "#22c55e"
    : health.plant_health_score >= 65 ? "#f59e0b"
    : health.plant_health_score >= 40 ? "#f97316" : "#ef4444";

  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 10, color: COLORS.textMuted, letterSpacing: "0.08em", marginBottom: 12 }}>
        PLANT HEALTH OVERVIEW
      </div>

      {/* Plant score */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <CircularGauge score={health.plant_health_score} size={72} strokeWidth={7} />
        <div>
          <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600 }}>Overall Plant Health</div>
          <div style={{ fontSize: 12, color: plantColor, fontWeight: 600, fontFamily: "monospace" }}>
            {health.plant_health_score}/100
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
            {health.critical_count > 0 && <span style={{ fontSize: 11, color: "#ef4444" }}>● {health.critical_count} Critical</span>}
            {health.poor_count > 0 && <span style={{ fontSize: 11, color: "#f97316" }}>● {health.poor_count} Poor</span>}
            {health.fair_count > 0 && <span style={{ fontSize: 11, color: "#f59e0b" }}>● {health.fair_count} Fair</span>}
            {health.good_count > 0 && <span style={{ fontSize: 11, color: "#22c55e" }}>● {health.good_count} Good</span>}
          </div>
        </div>
      </div>

      {/* Per-equipment bars */}
      {health.equipment_scores.map(eq => (
        <div key={eq.equipment_id}
          onClick={() => onSelectEquipment?.(eq.equipment_id)}
          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, cursor: onSelectEquipment ? "pointer" : "default" }}>
          <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace", width: 52, flexShrink: 0 }}>{eq.equipment_id}</span>
          <MiniHealthBar score={eq.health_score} width={90} />
          <span style={{ fontSize: 10, color: COLORS.textMuted }}>{eq.grade}</span>
          {eq.unack_alert_count > 0 && (
            <span style={{ fontSize: 9, background: "#450a0a", color: "#fca5a5", padding: "1px 5px", borderRadius: 8 }}>
              {eq.unack_alert_count}⚠
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function HealthScoreCard({ equipmentId }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!equipmentId) return;
    setLoading(true);
    trendApi.equipmentHealth(equipmentId)
      .then(setHealth)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [equipmentId]);

  if (loading) return (
    <div style={{ padding: 12, fontSize: 12, color: COLORS.textMuted, display: "flex", gap: 8 }}>
      <i className="ti ti-loader" style={{ fontSize: 14 }} /> Computing health score...
    </div>
  );
  if (!health) return null;

  return (
    <div style={{ padding: 14, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, display: "flex", gap: 16, alignItems: "flex-start" }}>
      <CircularGauge score={health.health_score} size={80} strokeWidth={8} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600, marginBottom: 4 }}>
          Health Score — {health.grade}
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
          {health.sensor_warning_count > 0 && (
            <span style={{ fontSize: 11, color: "#f97316" }}>{health.sensor_warning_count} sensor warnings</span>
          )}
          {health.sensor_critical_count > 0 && (
            <span style={{ fontSize: 11, color: "#ef4444" }}>{health.sensor_critical_count} sensor critical</span>
          )}
          {health.unack_alert_count > 0 && (
            <span style={{ fontSize: 11, color: "#fca5a5" }}>{health.unack_alert_count} unacked alerts</span>
          )}
        </div>
        {health.deductions.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>Score deductions:</div>
            {health.deductions.slice(0, 4).map((d, i) => (
              <div key={i} style={{ fontSize: 11, color: "#f97316", display: "flex", gap: 5 }}>
                <span>–</span><span>{d}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
