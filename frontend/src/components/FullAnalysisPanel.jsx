import { useState, useEffect } from "react";
import { fullAnalysisApi, plantApi } from "../utils/api.js";
import { COLORS, Markdown, SourcesPanel, SectionLabel, Spinner, ErrorBox } from "../utils/ui.jsx";
import FeedbackWidget from "./FeedbackWidget.jsx";

export default function FullAnalysisPanel({ ragStatus }) {
  const [equipment, setEquipment] = useState([]);
  const [selectedId, setSelectedId] = useState("RM-04");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    plantApi.equipment().then(d => setEquipment(d.equipment || [])).catch(() => {});
  }, []);

  async function runAnalysis() {
    if (!ragStatus?.built) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await fullAnalysisApi.run(selectedId);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const confColor = (c) => c >= 75 ? "#22c55e" : c >= 50 ? "#f59e0b" : "#ef4444";
  const confLabel = (c) => c >= 75 ? "High Confidence" : c >= 50 ? "Medium Confidence" : "Low Coverage";

  return (
    <div style={{ padding: 24, fontFamily: "'IBM Plex Sans', sans-serif", overflowY: "auto", height: "100%" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 600, margin: 0 }}>Full AI Analysis</h2>
        <p style={{ color: COLORS.textMuted, fontSize: 13, margin: "4px 0 0" }}>
          One click chains Diagnostic Agent → Recommendation Agent automatically with cost impact and confidence score.
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <label style={{ display: "block", fontSize: 11, color: COLORS.textMuted, marginBottom: 5 }}>Equipment</label>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            style={{ background: "#161c2d", border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.text, padding: "8px 12px", fontSize: 13 }}>
            {equipment.map(e => <option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
          </select>
        </div>
        <button onClick={runAnalysis} disabled={!ragStatus?.built || loading}
          style={{ padding: "9px 22px", background: ragStatus?.built ? "#1d4ed8" : "#1e2938", border: "none", borderRadius: 6, color: ragStatus?.built ? "#fff" : COLORS.textMuted, fontSize: 14, cursor: ragStatus?.built ? "pointer" : "not-allowed", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <i className={`ti ${loading ? "ti-loader" : "ti-analyze"}`} style={{ fontSize: 16 }} />
          {loading ? "Analysing..." : "Run Full Analysis"}
        </button>
        {!ragStatus?.built && (
          <span style={{ fontSize: 12, color: "#f59e0b" }}>Build RAG index first</span>
        )}
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: "center" }}>
          <i className="ti ti-analyze" style={{ fontSize: 32, color: "#3b82f6", display: "block", marginBottom: 12 }} />
          <div style={{ color: COLORS.textMuted, fontSize: 14, marginBottom: 6 }}>Running two-agent pipeline...</div>
          <div style={{ color: COLORS.textMuted, fontSize: 12 }}>Step 1: Diagnostic Agent → Step 2: Recommendation Agent</div>
        </div>
      )}

      {error && <ErrorBox message={error} />}

      {data && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Confidence + Cost Impact banner */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Confidence */}
            <div style={{ padding: 16, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 8, letterSpacing: "0.08em" }}>AI CONFIDENCE</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: confColor(data.confidence_pct), fontFamily: "monospace" }}>
                  {data.confidence_pct}%
                </div>
                <div>
                  <div style={{ fontSize: 13, color: confColor(data.confidence_pct), fontWeight: 600 }}>
                    {confLabel(data.confidence_pct)}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted }}>
                    {data.total_sources} sources retrieved
                  </div>
                </div>
              </div>
              <div style={{ height: 4, background: "#1e2938", borderRadius: 2, marginTop: 10 }}>
                <div style={{ height: "100%", width: `${data.confidence_pct}%`, background: confColor(data.confidence_pct), borderRadius: 2, transition: "width 0.8s ease" }} />
              </div>
            </div>

            {/* Cost Impact */}
            <div style={{ padding: 16, background: "#0a1628", border: "1px solid #1e3a6e", borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 8, letterSpacing: "0.08em" }}>BUSINESS IMPACT</div>
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 2 }}>Fix Now</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#22c55e", fontFamily: "monospace" }}>
                    {data.cost_impact?.repair_now_display}
                  </div>
                </div>
                <div style={{ width: 1, background: COLORS.border }} />
                <div>
                  <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 2 }}>Ignore Risk</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#ef4444", fontFamily: "monospace" }}>
                    {data.cost_impact?.failure_risk_display}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#4ade80", fontWeight: 600 }}>
                {data.cost_impact?.savings_display}
              </div>
            </div>
          </div>

          {/* RUL quick view */}
          {data.rul && (
            <div style={{ padding: "10px 14px", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ fontSize: 11, color: COLORS.textMuted }}>RUL ({data.rul.failure_mode?.replace(/_/g, " ")})</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: data.rul.rul_hours < 24 ? "#ef4444" : "#f59e0b", fontFamily: "monospace" }}>
                {data.rul.rul_display}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted }}>{data.rul.method}</div>
            </div>
          )}

          {/* Diagnosis */}
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", background: "#0f172a", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
              <span style={{ fontSize: 12, color: "#60a5fa", fontWeight: 600 }}>AGENT 1 — DIAGNOSTIC AGENT</span>
              <span style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: "auto" }}>{data.diagnosis_sources?.length || 0} sources</span>
            </div>
            <div style={{ padding: 16 }}>
              <Markdown text={data.diagnosis} />
              {data.diagnosis_sources?.length > 0 && <SourcesPanel sources={data.diagnosis_sources} />}
            </div>
          </div>

          {/* Recommendations */}
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", background: "#0f172a", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
              <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 600 }}>AGENT 2 — RECOMMENDATION AGENT</span>
              <span style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: "auto" }}>{data.recommendation_sources?.length || 0} sources</span>
            </div>
            <div style={{ padding: 16 }}>
              <Markdown text={data.recommendations} />
              {data.recommendation_sources?.length > 0 && <SourcesPanel sources={data.recommendation_sources} />}
            </div>
          </div>

          {/* Feedback */}
          <FeedbackWidget
            agentName="full_analysis"
            query={`Full analysis for ${data.equipment_id}`}
            response={data.diagnosis + "\n\n" + data.recommendations}
            equipmentId={data.equipment_id}
          />
        </div>
      )}
    </div>
  );
}
