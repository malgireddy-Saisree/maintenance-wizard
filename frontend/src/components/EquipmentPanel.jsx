import { useState, useEffect } from "react";
import { plantApi, agentApi } from "../utils/api.js";
import { COLORS, RISK_PALETTE, SEV_PALETTE, Dot, SectionLabel, Spinner, ErrorBox, SourcesPanel, Markdown } from "../utils/ui.jsx";
import TrendCharts from "./TrendCharts.jsx";
import HealthScoreCard from "./HealthScoreCard.jsx";

function RiskGauge({ score }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = clamped > 75 ? "#ef4444" : clamped > 50 ? "#f97316" : clamped > 25 ? "#f59e0b" : "#22c55e";
  const angle = (clamped / 100) * 180 - 90; // -90 to +90 degrees
  const rad = (angle * Math.PI) / 180;
  const needleX = 50 + 28 * Math.cos(rad - Math.PI / 2 + Math.PI);
  const needleY = 50 - 28 * Math.sin(rad - Math.PI / 2 + Math.PI);
  return (
    <svg viewBox="0 0 100 60" width={110} height={66}>
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="#1e2938" strokeWidth="8" />
      <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="url(#g)" strokeWidth="8"
        strokeDasharray={`${(clamped / 100) * 125.7} 125.7`} />
      <line x1="50" y1="50" x2={needleX} y2={needleY} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="50" cy="50" r="3.5" fill={color} />
      <text x="50" y="34" textAnchor="middle" fill={color} fontSize="13" fontFamily="monospace" fontWeight="600">{clamped}</text>
    </svg>
  );
}

function SensorCard({ name, reading }) {
  const lo = reading.normal_range[0], hi = reading.normal_range[1];
  const pct = Math.min(100, Math.max(0, ((reading.value - lo) / (hi - lo)) * 100));
  const col = reading.status === "critical" ? "#ef4444" : reading.status === "warning" ? "#f97316" : "#22c55e";
  return (
    <div style={{ padding: 12, background: COLORS.surface2, border: `1px solid ${reading.status !== "normal" ? col : COLORS.border}`, borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{name.replace(/_/g, " ")}</span>
        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: `${col}22`, color: col, fontFamily: "monospace", textTransform: "uppercase" }}>
          {reading.status}{reading.trend === "rising" ? " ↑" : reading.trend === "falling" ? " ↓" : ""}
        </span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, color: col, fontFamily: "monospace", marginBottom: 8 }}>
        {reading.value} <span style={{ fontSize: 13, color: COLORS.textMuted }}>{reading.unit}</span>
      </div>
      <div style={{ height: 4, background: "#1e2938", borderRadius: 2, marginBottom: 4 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: col, borderRadius: 2, transition: "width 0.5s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.textMuted, fontFamily: "monospace" }}>
        <span>{lo} {reading.unit}</span><span>{hi} {reading.unit}</span>
      </div>
    </div>
  );
}

const TABS = ["sensors", "trends", "alerts", "history", "spares"];

export default function EquipmentPanel({ selectedEquipmentId, setSelectedEquipmentId, ragStatus }) {
  const [equipList, setEquipList] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("sensors");
  const [riskData, setRiskData] = useState({});
  const [riskLoading, setRiskLoading] = useState({});
  const [riskSources, setRiskSources] = useState({});

  useEffect(() => {
    plantApi.equipment().then(d => {
      setEquipList(d.equipment || []);
      const first = d.equipment?.[0];
      if (first && !selectedEquipmentId) setSelectedEquipmentId(first.id);
    }).catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedEquipmentId) return;
    setLoading(true);
    setError(null);
    plantApi.equipmentDetail(selectedEquipmentId)
      .then(setDetail)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedEquipmentId]);

  async function runRiskAssessment() {
    if (!selectedEquipmentId || !ragStatus?.built) return;
    setRiskLoading(p => ({ ...p, [selectedEquipmentId]: true }));
    try {
      const result = await agentApi.riskScore(selectedEquipmentId);
      setRiskData(p => ({ ...p, [selectedEquipmentId]: result }));
      if (result.sources_used) setRiskSources(p => ({ ...p, [selectedEquipmentId]: result.sources_used }));
    } catch (e) {
      setError(e.message);
    } finally {
      setRiskLoading(p => ({ ...p, [selectedEquipmentId]: false }));
    }
  }

  const risk = riskData[selectedEquipmentId];
  const riskPal = risk ? (RISK_PALETTE[risk.overall_risk] || RISK_PALETTE.Unknown) : null;
  const eq = detail?.equipment;

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Equipment list sidebar */}
      <div style={{ width: 210, background: COLORS.surface, borderRight: `1px solid ${COLORS.border}`, overflowY: "auto", flexShrink: 0 }}>
        <div style={{ padding: "12px 12px 6px" }}><SectionLabel>Equipment</SectionLabel></div>
        {equipList.map(e => {
          const active = e.id === selectedEquipmentId;
          return (
            <div key={e.id} onClick={() => { setSelectedEquipmentId(e.id); setActiveTab("sensors"); }}
              style={{ padding: "9px 12px", cursor: "pointer", background: active ? "#1a2540" : "transparent", borderLeft: `2px solid ${active ? "#3b82f6" : "transparent"}` }}>
              <div style={{ fontSize: 13, color: active ? "#60a5fa" : COLORS.text, fontWeight: active ? 500 : 400 }}>{e.name}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace" }}>{e.id} · {e.criticality}</div>
            </div>
          );
        })}
      </div>

      {/* Detail panel */}
      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
        {loading && <Spinner label="Loading equipment data..." />}
        {error && <ErrorBox message={error} />}

        {detail && eq && (
          <>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ color: COLORS.text, fontSize: 19, fontWeight: 600, margin: 0 }}>{eq.name}</h2>
                <div style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: "monospace", marginTop: 4 }}>
                  {eq.id} · {eq.location} · Installed {eq.install_year} · {eq.criticality?.toUpperCase()} criticality · {eq.operating_hours?.toLocaleString()} hrs
                </div>
              </div>
              <button onClick={runRiskAssessment}
                disabled={!ragStatus?.built || riskLoading[selectedEquipmentId]}
                style={{ padding: "7px 16px", background: ragStatus?.built ? "#1d4ed8" : "#1e2938", border: "none", borderRadius: 6, color: ragStatus?.built ? "#fff" : COLORS.textMuted, fontSize: 13, cursor: ragStatus?.built ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
                <i className={`ti ${riskLoading[selectedEquipmentId] ? "ti-loader" : "ti-brain"}`} style={{ fontSize: 14 }} />
                {riskLoading[selectedEquipmentId] ? "Analysing..." : "AI Risk Assessment"}
              </button>
            </div>

            {/* Health Score */}
            <div style={{ marginBottom: 16 }}>
              <HealthScoreCard equipmentId={eq.id} />
            </div>

            {/* Risk result */}
            {risk && riskPal && (
              <div style={{ padding: 16, marginBottom: 20, background: riskPal.bg, border: `1px solid ${riskPal.border}`, borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                  <RiskGauge score={risk.risk_score} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                      {[
                        { l: "Overall Risk", v: risk.overall_risk, c: riskPal.text },
                        { l: "Failure Prob.", v: `${risk.failure_probability}%`, c: "#fca5a5" },
                        { l: "RUL", v: risk.rul, c: "#60a5fa" },
                        { l: "Trend", v: risk.trend, c: risk.trend === "Deteriorating" ? "#f97316" : "#22c55e" },
                        { l: "Impact if Failed", v: risk.production_impact_if_failed, c: "#fcd34d" },
                      ].map(it => (
                        <div key={it.l} style={{ background: "rgba(0,0,0,0.3)", padding: "5px 10px", borderRadius: 6 }}>
                          <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 2 }}>{it.l}</div>
                          <div style={{ fontSize: 12, color: it.c, fontWeight: 600, fontFamily: "monospace" }}>{it.v}</div>
                        </div>
                      ))}
                    </div>
                    {risk.diagnosis && <p style={{ fontSize: 12, color: "#c8d0e0", margin: "0 0 8px", lineHeight: 1.6 }}>{risk.diagnosis}</p>}
                    {risk.immediate_actions?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 4 }}>Immediate Actions:</div>
                        {risk.immediate_actions.map((a, i) => (
                          <div key={i} style={{ fontSize: 12, color: "#fdba74", display: "flex", gap: 5, marginBottom: 2 }}>
                            <span>›</span><span>{a}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {riskSources[selectedEquipmentId]?.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 11, color: COLORS.textMuted }}>
                        Sources: {riskSources[selectedEquipmentId].map((s, i) => (
                          <span key={i} style={{ background: "#1a2540", color: "#60a5fa", padding: "0 5px", borderRadius: 3, marginLeft: 4, fontFamily: "monospace", fontSize: 10 }}>[{i+1}] {s.slice(0, 35)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.border}`, marginBottom: 16 }}>
              {TABS.map(tab => {
                const count = tab === "trends" ? Object.keys(detail.sensors || {}).length
                  : tab === "sensors" ? Object.keys(detail.sensors || {}).length
                  : tab === "alerts" ? (detail.alerts || []).length
                  : tab === "history" ? (detail.history || []).length
                  : (detail.spares || []).length;
                return (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    style={{ padding: "7px 16px", background: "transparent", border: "none", borderBottom: `2px solid ${activeTab === tab ? "#3b82f6" : "transparent"}`, color: activeTab === tab ? "#60a5fa" : COLORS.textMuted, fontSize: 13, cursor: "pointer", textTransform: "capitalize" }}>
                    {tab} ({count})
                  </button>
                );
              })}
            </div>

            {/* Sensors */}
            {activeTab === "sensors" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
                {Object.entries(detail.sensors || {}).map(([k, v]) => <SensorCard key={k} name={k} reading={v} />)}
              </div>
            )}

            {/* Trends */}
            {activeTab === "trends" && (
              <TrendCharts equipmentId={selectedEquipmentId} />
            )}

            {/* Alerts */}
            {activeTab === "alerts" && (
              <div>
                {!(detail.alerts?.length) && <p style={{ color: COLORS.textMuted, fontSize: 13 }}>No alerts for this equipment.</p>}
                {(detail.alerts || []).map(a => {
                  const pal = SEV_PALETTE[a.severity] || SEV_PALETTE.low;
                  return (
                    <div key={a.id} style={{ padding: 14, marginBottom: 10, background: a.acknowledged ? COLORS.surface2 : pal.bg, border: `1px solid ${a.acknowledged ? COLORS.border : pal.border}`, borderRadius: 8, opacity: a.acknowledged ? 0.65 : 1 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                        <Dot color={a.acknowledged ? COLORS.textMuted : pal.dot} />
                        <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace" }}>{a.id}</span>
                        <span style={{ fontSize: 11, color: pal.text, fontWeight: 600 }}>{a.severity.toUpperCase()}</span>
                        {a.acknowledged && <span style={{ fontSize: 11, color: COLORS.textMuted }}>ACKNOWLEDGED</span>}
                      </div>
                      <p style={{ fontSize: 13, color: "#c8d0e0", margin: "0 0 6px", lineHeight: 1.6 }}>{a.message}</p>
                      <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace" }}>{new Date(a.timestamp).toLocaleString("en-IN")}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* History */}
            {activeTab === "history" && (
              <div>
                {(detail.history || []).map(r => (
                  <div key={r.id} style={{ padding: 14, marginBottom: 10, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#60a5fa", fontFamily: "monospace" }}>{r.id}</span>
                        <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 3, background: r.type === "Emergency" ? "#450a0a" : r.type === "Corrective" ? "#431407" : "#052e16", color: r.type === "Emergency" ? "#fca5a5" : r.type === "Corrective" ? "#fdba74" : "#86efac" }}>{r.type}</span>
                      </div>
                      <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace" }}>{r.date}</span>
                    </div>
                    <p style={{ fontSize: 13, color: "#c8d0e0", margin: "0 0 8px", lineHeight: 1.6 }}>{r.action}</p>
                    {r.root_cause && <div style={{ fontSize: 12, color: "#fdba74", padding: "5px 10px", background: "#431407", borderRadius: 4, marginBottom: 8 }}><strong>Root Cause:</strong> {r.root_cause}</div>}
                    <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace", display: "flex", gap: 16 }}>
                      <span>Duration: {r.duration_hours}h</span>
                      <span>Tech: {r.technician}</span>
                      <span>Cost: ₹{r.cost_inr?.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Spares */}
            {activeTab === "spares" && (
              <div>
                {!(detail.spares?.length) && <p style={{ color: COLORS.textMuted, fontSize: 13 }}>No spare parts mapped to this equipment.</p>}
                {(detail.spares || []).map(s => {
                  const low = s.qty <= s.min_stock;
                  return (
                    <div key={s.id} style={{ padding: 14, marginBottom: 10, background: COLORS.surface2, border: `1px solid ${low ? "#7c2d12" : COLORS.border}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 500, marginBottom: 4 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace" }}>{s.id} · Lead time: {s.lead_time} · ₹{s.cost_inr?.toLocaleString("en-IN")}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 26, fontWeight: 600, color: low ? "#ef4444" : "#22c55e", fontFamily: "monospace" }}>{s.qty}</div>
                        <div style={{ fontSize: 10, color: COLORS.textMuted }}>in stock</div>
                        <div style={{ fontSize: 10, color: low ? "#f97316" : COLORS.textMuted }}>min: {s.min_stock} {low ? "⚠ LOW" : "✓"}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
