import { useState } from "react";
import { feedbackApi } from "../utils/api.js";
import { COLORS } from "../utils/ui.jsx";

export default function FeedbackWidget({ agentName, query, response, equipmentId }) {
  const [state, setState] = useState("idle"); // idle | rating | correcting | submitting | done
  const [rating, setRating] = useState(null);
  const [correction, setCorrection] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function submitRating(r) {
    setRating(r);
    if (r === "correct") {
      await doSubmit(r, null);
    } else {
      setState("correcting");
    }
  }

  async function doSubmit(r, correctionText) {
    setState("submitting");
    try {
      await feedbackApi.submit(agentName, query, response, r, correctionText || null, equipmentId);
      setState("done");
      setSubmitted(true);
    } catch (e) {
      setState("idle");
    }
  }

  if (submitted) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <i className="ti ti-circle-check" style={{ fontSize: 13, color: "#22c55e" }} />
        <span style={{ fontSize: 11, color: "#4ade80" }}>
          Feedback recorded{rating !== "correct" && correction ? " — correction distilled for future improvements" : ""}
        </span>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      {state === "idle" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>Was this helpful?</span>
          <button onClick={() => submitRating("correct")}
            style={{ padding: "3px 10px", background: "transparent", border: "1px solid #166534", borderRadius: 4, color: "#4ade80", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <i className="ti ti-thumb-up" style={{ fontSize: 12 }} /> Yes
          </button>
          <button onClick={() => { setRating("partial"); setState("correcting"); }}
            style={{ padding: "3px 10px", background: "transparent", border: "1px solid #78350f", borderRadius: 4, color: "#fcd34d", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <i className="ti ti-edit" style={{ fontSize: 12 }} /> Partially
          </button>
          <button onClick={() => { setRating("incorrect"); setState("correcting"); }}
            style={{ padding: "3px 10px", background: "transparent", border: "1px solid #7f1d1d", borderRadius: 4, color: "#fca5a5", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <i className="ti ti-thumb-down" style={{ fontSize: 12 }} /> Incorrect
          </button>
        </div>
      )}

      {state === "correcting" && (
        <div style={{ background: "#0d1117", border: "1px solid #2a3a52", borderRadius: 6, padding: 10, marginTop: 4 }}>
          <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 6 }}>
            {rating === "partial" ? "What was incorrect or missing?" : "What should the correct answer be?"}
          </div>
          <textarea
            value={correction}
            onChange={e => setCorrection(e.target.value)}
            placeholder="Provide the correct information or what was wrong..."
            rows={3}
            style={{ width: "100%", padding: "7px 10px", background: "#161c2d", border: "1px solid #2a3a52", borderRadius: 5, color: COLORS.text, fontSize: 12, resize: "vertical", fontFamily: "'IBM Plex Sans', sans-serif", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => doSubmit(rating, correction)}
              disabled={!correction.trim()}
              style={{ padding: "5px 14px", background: correction.trim() ? "#1d4ed8" : "#1e2938", border: "none", borderRadius: 5, color: correction.trim() ? "#fff" : COLORS.textMuted, fontSize: 12, cursor: correction.trim() ? "pointer" : "not-allowed", fontWeight: 500 }}>
              Submit Correction
            </button>
            <button onClick={() => doSubmit(rating, null)}
              style={{ padding: "5px 12px", background: "transparent", border: "1px solid #2a3a52", borderRadius: 5, color: COLORS.textMuted, fontSize: 12, cursor: "pointer" }}>
              Skip
            </button>
          </div>
        </div>
      )}

      {state === "submitting" && (
        <div style={{ fontSize: 11, color: COLORS.textMuted, display: "flex", gap: 6, marginTop: 4 }}>
          <i className="ti ti-loader" style={{ fontSize: 12 }} /> Submitting feedback...
        </div>
      )}
    </div>
  );
}
