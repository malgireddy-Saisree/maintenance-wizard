import { useState, useEffect } from "react";
import { feedbackApi } from "../utils/api.js";
import { COLORS, SectionLabel, Spinner, ErrorBox } from "../utils/ui.jsx";

const RATING_STYLE = {
  correct:   { color: "#4ade80", bg: "#052e16", icon: "ti-thumb-up" },
  partial:   { color: "#fcd34d", bg: "#422006", icon: "ti-edit" },
  incorrect: { color: "#fca5a5", bg: "#450a0a", icon: "ti-thumb-down" },
};

export default function FeedbackDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    feedbackApi.summary()
      .then(setSummary)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function refresh() {
    setLoading(true);
    feedbackApi.summary()
      .then(setSummary)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 600, margin: 0 }}>Feedback Loop Dashboard</h2>
          <p style={{ color: COLORS.textMuted, fontSize: 13, margin: "4px 0 0" }}>
            Engineer corrections are distilled into few-shot examples that improve future agent responses.
          </p>
        </div>
        <button onClick={refresh} style={{ padding: "6px 14px", background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.textMuted, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <i className="ti ti-refresh" style={{ fontSize: 13 }} /> Refresh
        </button>
      </div>

      {loading && <Spinner label="Loading feedback data..." />}
      {error && <ErrorBox message={error} />}

      {summary && (
        <>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Total Feedback", value: summary.total_feedback, color: "#60a5fa", icon: "ti-messages" },
              { label: "Correct",        value: summary.correct,        color: "#4ade80", icon: "ti-thumb-up" },
              { label: "Partially Right",value: summary.partial,        color: "#fcd34d", icon: "ti-edit" },
              { label: "Incorrect",      value: summary.incorrect,      color: "#fca5a5", icon: "ti-thumb-down" },
            ].map(s => (
              <div key={s.label} style={{ padding: "14px 16px", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: COLORS.textMuted }}>{s.label}</span>
                  <i className={`ti ${s.icon}`} style={{ fontSize: 14, color: s.color }} />
                </div>
                <div style={{ fontSize: 28, fontWeight: 600, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Correction examples */}
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 20 }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600 }}>
                Distilled Correction Examples ({summary.correction_examples})
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
                These are injected as few-shot context into future agent calls.
              </div>
            </div>
            {summary.correction_examples === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
                <i className="ti ti-mood-empty" style={{ fontSize: 28, display: "block", marginBottom: 8 }} />
                No corrections yet. Rate AI responses using the 👍 / ✏ / 👎 buttons in the chat.
              </div>
            ) : (
              <div style={{ padding: "8px 0" }}>
                {/* Placeholder — real correction examples would come from backend */}
                <div style={{ padding: "12px 16px", color: COLORS.textMuted, fontSize: 12 }}>
                  {summary.correction_examples} correction example{summary.correction_examples > 1 ? "s" : ""} stored and active.
                  These are automatically injected into relevant agent prompts.
                </div>
              </div>
            )}
          </div>

          {/* Recent feedback */}
          {summary.recent?.length > 0 && (
            <div>
              <SectionLabel>Recent Feedback</SectionLabel>
              {summary.recent.map((fb, i) => {
                const sty = RATING_STYLE[fb.rating] || RATING_STYLE.correct;
                return (
                  <div key={i} style={{ padding: 14, marginBottom: 10, background: sty.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                      <i className={`ti ${sty.icon}`} style={{ fontSize: 14, color: sty.color }} />
                      <span style={{ fontSize: 12, color: sty.color, fontWeight: 600 }}>{fb.rating.toUpperCase()}</span>
                      <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace" }}>{fb.feedback_id}</span>
                      <span style={{ fontSize: 11, color: COLORS.textMuted }}>· {fb.agent}</span>
                      {fb.equipment_id && <span style={{ fontSize: 11, color: "#60a5fa" }}>· {fb.equipment_id}</span>}
                      <span style={{ marginLeft: "auto", fontSize: 10, color: COLORS.textMuted, fontFamily: "monospace" }}>
                        {new Date(fb.timestamp).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: fb.correction ? 6 : 0 }}>
                      <strong>Query:</strong> {fb.query?.slice(0, 120)}{fb.query?.length > 120 ? "..." : ""}
                    </div>
                    {fb.correction && (
                      <div style={{ fontSize: 12, color: "#fcd34d", padding: "6px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 4, marginTop: 4 }}>
                        <strong>Correction:</strong> {fb.correction}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* How it works */}
          <div style={{ padding: 16, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, marginTop: 16 }}>
            <SectionLabel>How the Feedback Loop Works</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {[
                { icon: "ti-message", label: "1. Engineer rates response", sub: "👍 Correct / ✏ Partial / 👎 Incorrect" },
                { icon: "ti-brain", label: "2. Correction distilled", sub: "GPT-4o extracts generalizable few-shot example" },
                { icon: "ti-database", label: "3. Stored in memory", sub: "Production: persisted to Azure Cosmos DB" },
                { icon: "ti-arrow-back-up", label: "4. Injected into future prompts", sub: "Agent gets correction context on next call" },
              ].map(s => (
                <div key={s.label} style={{ padding: "10px 12px", background: "#111827", borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
                  <i className={`ti ${s.icon}`} style={{ fontSize: 18, color: "#3b82f6", display: "block", marginBottom: 6 }} />
                  <div style={{ fontSize: 12, color: COLORS.text, fontWeight: 500, marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
