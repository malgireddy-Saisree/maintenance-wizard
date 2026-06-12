import { useState, useEffect } from "react";
import { ragApi } from "../utils/api.js";
import { COLORS, DOC_TYPE_COLORS, SectionLabel, Spinner, ErrorBox } from "../utils/ui.jsx";

const PIPELINE_STEPS = [
  { icon: "ti-files",       label: "Documents",      sub: "11 source docs",       color: "#3b82f6" },
  { icon: "ti-scissors",    label: "Chunking",        sub: "800 char / 120 overlap",color: "#8b5cf6" },
  { icon: "ti-vector",      label: "Embeddings",      sub: "Azure ada-3-small",    color: "#06b6d4" },
  { icon: "ti-database",    label: "Vector Index",    sub: "NumPy in-memory",      color: "#f59e0b" },
  { icon: "ti-search",      label: "Hybrid Retrieval",sub: "Semantic + keyword",   color: "#22c55e" },
  { icon: "ti-robot",       label: "Grounded LLM",    sub: "GPT-4o + [SOURCE N]",  color: "#e85d04" },
];

export default function RAGIndexPanel({ onIndexReady }) {
  const [status, setStatus] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [progress, setProgress] = useState(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState(null);
  const [showChunks, setShowChunks] = useState(false);

  useEffect(() => {
    ragApi.status().then(s => { setStatus(s); if (s.built) onIndexReady?.(); }).catch(e => setError(e.message));
    ragApi.chunks(80).then(d => setChunks(d.chunks || [])).catch(() => {});
  }, []);

  async function buildIndex() {
    setBuilding(true);
    setError(null);
    setProgress({ stage: "starting", done: 0, total: 0, pct: 0 });
    try {
      const res = await ragApi.buildStream();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        for (const line of text.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              setProgress(data);
              if (data.stage === "done") {
                const s = await ragApi.status();
                setStatus(s);
                onIndexReady?.();
              }
              if (data.stage === "error") setError(data.message);
            } catch {}
          }
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBuilding(false);
    }
  }

  async function resetIndex() {
    await ragApi.reset();
    const s = await ragApi.status();
    setStatus(s);
    setProgress(null);
  }

  const docTypes = [...new Set(chunks.map(c => c.doc_type))];

  return (
    <div style={{ padding: 24, fontFamily: "'IBM Plex Sans', sans-serif", maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 600, margin: 0 }}>RAG Knowledge Index</h2>
        <p style={{ color: COLORS.textMuted, fontSize: 13, margin: "6px 0 0", lineHeight: 1.6 }}>
          Embeds all document chunks using Azure OpenAI Embeddings, then uses hybrid retrieval
          (semantic cosine similarity + keyword boost + equipment relevance) to ground every agent response in cited source documents.
        </p>
      </div>

      {/* Pipeline diagram */}
      <div style={{ padding: 16, marginBottom: 20, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
        <SectionLabel>RAG Pipeline</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
          {PIPELINE_STEPS.map((step, i) => (
            <div key={step.label} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ textAlign: "center", minWidth: 95 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, margin: "0 auto 6px", background: `${step.color}18`, border: `1px solid ${step.color}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className={`ti ${step.icon}`} style={{ fontSize: 18, color: step.color }} />
                </div>
                <div style={{ fontSize: 11, color: COLORS.text, fontWeight: 500 }}>{step.label}</div>
                <div style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: "monospace" }}>{step.sub}</div>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div style={{ fontSize: 18, color: COLORS.border2, margin: "0 2px", paddingBottom: 16 }}>→</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Status card */}
      <div style={{ padding: 16, marginBottom: 16, background: status?.built ? "#052e16" : COLORS.surface, border: `1px solid ${status?.built ? "#166534" : COLORS.border}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: status?.built ? "#22c55e" : building ? "#f59e0b" : "#4a5568", boxShadow: status?.built ? "0 0 8px #22c55e" : building ? "0 0 8px #f59e0b" : "none" }} />
          <div>
            <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 600 }}>
              {status?.built ? "Index Ready" : building ? "Building Index..." : "Index Not Built"}
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: "monospace" }}>
              {status?.built
                ? `${status.chunk_count} chunks indexed from ${status.doc_count} documents`
                : `${status?.chunk_count_preview || 0} chunks will be embedded from ${status?.doc_count || 0} documents`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {status?.built && (
            <button onClick={resetIndex} style={{ padding: "6px 14px", background: "transparent", border: `1px solid ${COLORS.border2}`, borderRadius: 6, color: COLORS.textMuted, fontSize: 12, cursor: "pointer" }}>
              Reset Index
            </button>
          )}
          <button onClick={buildIndex} disabled={building}
            style={{ padding: "6px 16px", background: building ? "#1e2938" : "#1d4ed8", border: "none", borderRadius: 6, color: building ? COLORS.textMuted : "#fff", fontSize: 13, cursor: building ? "not-allowed" : "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
            <i className={`ti ${building ? "ti-loader" : status?.built ? "ti-refresh" : "ti-player-play"}`} style={{ fontSize: 13 }} />
            {building ? "Building..." : status?.built ? "Rebuild" : "Build Index"}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {progress && progress.stage === "embedding" && (
        <div style={{ padding: 14, marginBottom: 16, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: COLORS.textMuted }}>Embedding chunks ({progress.done}/{progress.total})</span>
            <span style={{ fontSize: 12, color: "#60a5fa", fontFamily: "monospace" }}>{progress.pct || 0}%</span>
          </div>
          <div style={{ height: 5, background: "#1e2938", borderRadius: 3 }}>
            <div style={{ height: "100%", width: `${progress.pct || 0}%`, background: "#3b82f6", borderRadius: 3, transition: "width 0.3s" }} />
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 6 }}>
            120ms delay between API calls to respect Azure OpenAI rate limits.
          </div>
        </div>
      )}

      {error && <div style={{ marginBottom: 16 }}><ErrorBox message={error} /></div>}

      {/* Note about embedding deployment */}
      <div style={{ padding: "9px 14px", marginBottom: 16, background: "#1a1500", border: "1px solid #78350f", borderRadius: 6, fontSize: 12, color: "#fcd34d", display: "flex", gap: 8 }}>
        <i className="ti ti-info-circle" style={{ fontSize: 14, flexShrink: 0 }} />
        Requires an embedding deployment in your Azure OpenAI resource.
        Deploy <strong>text-embedding-3-small</strong> or <strong>text-embedding-ada-002</strong> and set <code style={{ background: "#2a2000", padding: "0 4px", borderRadius: 3 }}>AZURE_EMBEDDING_DEPLOYMENT</code> in your backend <code>.env</code> file.
      </div>

      {/* Document corpus table */}
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: COLORS.textMuted, fontWeight: 500 }}>
            Document Corpus ({chunks.length} chunks)
          </span>
          <button onClick={() => setShowChunks(!showChunks)} style={{ background: "transparent", border: "none", color: "#60a5fa", fontSize: 12, cursor: "pointer" }}>
            {showChunks ? "Hide chunk preview" : "Show chunk preview"}
          </button>
        </div>

        {/* Doc type badges */}
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {docTypes.map(type => {
            const count = chunks.filter(c => c.doc_type === type).length;
            const color = DOC_TYPE_COLORS[type] || "#4a5568";
            return (
              <div key={type} style={{ padding: "4px 10px", borderRadius: 5, background: `${color}15`, border: `1px solid ${color}44` }}>
                <span style={{ fontSize: 12, color, fontWeight: 500 }}>{type.replace("_", " ")}</span>
                <span style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: 8, fontFamily: "monospace" }}>{count} chunks</span>
              </div>
            );
          })}
        </div>

        {/* Chunk list */}
        <div style={{ maxHeight: showChunks ? 600 : 280, overflowY: "auto" }}>
          {chunks.map((chunk, i) => (
            <div key={chunk.chunk_id}
              style={{ padding: "9px 16px", borderBottom: `1px solid ${COLORS.surface}`, background: i % 2 === 0 ? COLORS.surface : COLORS.surface2, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: DOC_TYPE_COLORS[chunk.doc_type] || "#4a5568", flexShrink: 0, marginTop: 4 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: COLORS.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chunk.title}</div>
                {showChunks && <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5, marginTop: 3 }}>{chunk.content_preview}…</div>}
              </div>
              <div style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: "monospace", flexShrink: 0, textAlign: "right" }}>
                <div>{chunk.doc_type}</div>
                <div>{chunk.char_count} chars</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
