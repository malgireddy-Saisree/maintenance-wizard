import { useState, useRef, useEffect } from "react";
import { agentApi, plantApi, streamChat } from "../utils/api.js";
import { COLORS, Markdown, SourcesPanel, ErrorBox } from "../utils/ui.jsx";
import FeedbackWidget from "./FeedbackWidget.jsx";

const PROMPTS = [
  "Rolling Mill #4 bearing temperature is rising at 2°C/hr. What's causing it?",
  "Walk me through the step-by-step bearing replacement procedure for RM-04",
  "What happens if tuyere temperature exceeds 285°C and what must I do?",
  "Which equipment needs the most urgent attention this week?",
  "What spare parts are critically low and need procurement now?",
  "Using TB-2024-12, calculate the RUL for RM-04 bearing at 131,040 hours",
  "What was the root cause of the January 2026 BF-01 tuyere burnthrough?",
  "Give me a risk summary comparing all six pieces of equipment",
];

export default function ChatInterface({ selectedEquipmentId, setSelectedEquipmentId, ragStatus, messages: messagesProp, setMessages: setMessagesProp }) {
  const initMessage = {
    role: "assistant",
    content: `## Welcome to MaintenanceWizard\n\nI'm your RAG-powered maintenance expert for Tata Steel's Jamshedpur plant.\n\n${
      ragStatus?.built
        ? `✅ **Knowledge index ready** — ${ragStatus.chunk_count} chunks indexed. All answers grounded in manuals, SOPs, and failure reports with [SOURCE N] citations.\n\n**⚠ Active alert:** Rolling Mill #4 bearing temperature rising at 2°C/hr. Shall I diagnose this?`
        : `⚠️ **RAG index not built yet.** Go to the **RAG Index** tab and click Build Index. I can still help using live plant data in the meantime.`
    }`,
    sources: [],
    timestamp: new Date().toISOString(),
  };
  const [localMessages, setLocalMessages] = useState([initMessage]);
  const messages = messagesProp ?? localMessages;
  const setMessages = setMessagesProp ?? setLocalMessages;

  // Initialise lifted state on first mount if not yet set
  useEffect(() => {
    if (setMessagesProp && messagesProp === null) {
      setMessagesProp([initMessage]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [useStream, setUseStream] = useState(true);
  const [error, setError] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const bottomRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    plantApi.equipment().then(d => setEquipment(d.equipment || [])).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text = input) {
    const msg = text.trim();
    if (!msg || loading || streaming) return;
    setError(null);
    setInput("");

    const userMsg = { role: "user", content: msg, sources: [], timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);

    if (useStream) {
      await sendStreaming(msg);
    } else {
      await sendNormal(msg);
    }
  }

  async function sendStreaming(msg) {
    setStreaming(true);
    // Add empty assistant message that we'll fill token by token
    const assistantMsg = {
      role: "assistant", content: "", sources: [],
      timestamp: new Date().toISOString(), streaming: true,
    };
    setMessages(prev => [...prev, assistantMsg]);
    const assistantIdx = messages.length + 1; // +1 for user msg just added

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await streamChat(msg, history, selectedEquipmentId || null);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) { setError(data.error); break; }
            if (data.token) {
              fullContent += data.token;
              setMessages(prev => prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: fullContent } : m
              ));
            }
            if (data.done) {
              setMessages(prev => prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: fullContent, streaming: false, query: msg } : m
              ));
            }
          } catch {}
        }
      }
    } catch (e) {
      setError(e.message);
      setMessages(prev => prev.slice(0, -1)); // remove empty assistant msg
    } finally {
      setStreaming(false);
    }
  }

  async function sendNormal(msg) {
    setLoading(true);
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await agentApi.chat(msg, history, selectedEquipmentId || null);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: res.response,
        sources: res.sources || [],
        timestamp: new Date().toISOString(),
        indexUsed: res.index_was_used,
        query: msg,
      }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const isActive = loading || streaming;

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* Chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Toolbar */}
        <div style={{ padding: "8px 16px", background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>Context:</span>
          <select value={selectedEquipmentId || ""} onChange={e => setSelectedEquipmentId(e.target.value || null)}
            style={{ background: "#161c2d", border: `1px solid ${COLORS.border}`, borderRadius: 4, color: COLORS.text, padding: "3px 8px", fontSize: 12, fontFamily: "monospace" }}>
            <option value="">All Equipment</option>
            {equipment.map(e => <option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
          </select>

          {/* RAG status */}
          <div style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 5, background: ragStatus?.built ? "#052e16" : "#1a1a2e", border: `1px solid ${ragStatus?.built ? "#166534" : "#2a3a52"}`, color: ragStatus?.built ? "#4ade80" : "#64748b" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: ragStatus?.built ? "#22c55e" : "#4a5568" }} />
            {ragStatus?.built ? `RAG: ${ragStatus.chunk_count} chunks` : "RAG: not built"}
          </div>

          {/* Streaming toggle */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: COLORS.textMuted }}>Stream</span>
            <div onClick={() => setUseStream(!useStream)}
              style={{ width: 32, height: 17, borderRadius: 9, background: useStream ? "#1d4ed8" : "#1e2938", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <div style={{ width: 13, height: 13, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: useStream ? 17 : 2, transition: "left 0.2s" }} />
            </div>
          </div>

          <button onClick={() => setMessages([initMessage])}
            style={{ padding: "3px 10px", background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 4, color: COLORS.textMuted, fontSize: 11, cursor: "pointer" }}>
            <i className="ti ti-refresh" style={{ fontSize: 11 }} /> New Session
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 22, flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: msg.role === "user" ? "#1d4ed8" : "#e85d04", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className={`ti ${msg.role === "user" ? "ti-user" : "ti-robot"}`} style={{ color: "#fff", fontSize: 14 }} />
              </div>
              <div style={{ maxWidth: "78%", minWidth: 0 }}>
                <div style={{ padding: "11px 14px", background: msg.role === "user" ? "#1a2a4a" : COLORS.surface, border: `1px solid ${msg.role === "user" ? "#2a3a6a" : COLORS.border}`, borderRadius: msg.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px", position: "relative" }}>
                  {msg.role === "assistant"
                    ? <Markdown text={msg.content || "…"} />
                    : <p style={{ fontSize: 13, color: "#c8d0e0", margin: 0, lineHeight: 1.6 }}>{msg.content}</p>
                  }
                  {msg.streaming && (
                    <span style={{ display: "inline-block", width: 8, height: 14, background: "#e85d04", borderRadius: 1, marginLeft: 2, animation: "blink 0.8s step-end infinite", verticalAlign: "text-bottom" }}>
                      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
                    </span>
                  )}
                </div>
                {/* Sources */}
                {msg.sources?.length > 0 && <SourcesPanel sources={msg.sources} />}
                {/* Metadata row */}
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4, fontFamily: "monospace", display: "flex", gap: 10, alignItems: "center", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                  <span>{new Date(msg.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                  {msg.sources?.length > 0 && <span>· {msg.sources.length} sources</span>}
                  {msg.indexUsed === false && <span style={{ color: "#f59e0b" }}>· live data only</span>}
                </div>
                {/* Feedback widget for assistant messages */}
                {msg.role === "assistant" && !msg.streaming && i > 0 && msg.query && (
                  <FeedbackWidget
                    agentName="conversational_agent"
                    query={msg.query}
                    response={msg.content}
                    equipmentId={selectedEquipmentId}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator (non-stream) */}
          {loading && (
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e85d04", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="ti ti-robot" style={{ color: "#fff", fontSize: 14 }} />
              </div>
              <div style={{ padding: "11px 14px", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "4px 12px 12px 12px" }}>
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  {[0, 0.2, 0.4].map((d, i) => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#e85d04", animation: "pulse 1.2s infinite", animationDelay: `${d}s` }} />)}
                  <style>{`@keyframes pulse{0%,80%,100%{opacity:0.2}40%{opacity:1}}`}</style>
                  <span style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: 6 }}>Retrieving sources → generating grounded response...</span>
                </div>
              </div>
            </div>
          )}

          {error && <div style={{ marginBottom: 16 }}><ErrorBox message={error} /></div>}
          <div ref={bottomRef} />
        </div>

        {/* Suggested prompts */}
        {messages.length <= 1 && (
          <div style={{ padding: "0 20px 10px" }}>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 8, fontFamily: "monospace", letterSpacing: "0.08em" }}>SUGGESTED QUERIES</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PROMPTS.slice(0, 4).map((p, i) => (
                <button key={i} onClick={() => send(p)}
                  style={{ padding: "5px 11px", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 20, color: COLORS.textDim, fontSize: 11, cursor: "pointer" }}>
                  {p.slice(0, 52)}...
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: "10px 20px 14px", borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={useStream ? "Ask anything — response will stream token by token..." : "Ask about equipment faults, maintenance procedures, risk assessments..."}
              rows={2}
              style={{ flex: 1, padding: "9px 12px", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontSize: 13, resize: "none", fontFamily: "'IBM Plex Sans', sans-serif", lineHeight: 1.5 }} />
            <button onClick={() => send()} disabled={!input.trim() || isActive}
              style={{ padding: "9px 18px", background: isActive || !input.trim() ? "#1e2938" : "#1d4ed8", border: "none", borderRadius: 8, color: isActive ? COLORS.textMuted : "#fff", fontSize: 13, cursor: isActive ? "not-allowed" : "pointer", fontWeight: 500, height: 66, display: "flex", alignItems: "center", gap: 6 }}>
              <i className={`ti ${isActive ? "ti-loader" : "ti-send"}`} style={{ fontSize: 14 }} />
              {streaming ? "..." : loading ? "..." : "Send"}
            </button>
          </div>
          <div style={{ fontSize: 10, color: "#374151", marginTop: 5, fontFamily: "monospace" }}>
            Shift+Enter for newline · {useStream ? "🔴 Streaming mode" : "Standard mode"} · Python FastAPI + Azure OpenAI
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div style={{ width: 210, background: COLORS.surface, borderLeft: `1px solid ${COLORS.border}`, padding: 14, overflowY: "auto", flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 10, letterSpacing: "0.08em" }}>MORE QUERIES</div>
        {PROMPTS.slice(4).map((p, i) => (
          <button key={i} onClick={() => send(p)}
            style={{ width: "100%", padding: "7px 9px", marginBottom: 6, background: "#111827", border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.textDim, fontSize: 11, cursor: "pointer", textAlign: "left", lineHeight: 1.4 }}>
            {p}
          </button>
        ))}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 8 }}>WHAT'S NEW</div>
          {[
            { icon: "ti-player-play", label: "Token streaming", sub: "Responses appear as they generate" },
            { icon: "ti-thumb-up", label: "Feedback loop", sub: "Rate & correct AI responses" },
            { icon: "ti-chart-line", label: "Trend charts", sub: "24h sensor history in Equipment tab" },
            { icon: "ti-activity", label: "Health scores", sub: "0-100 per equipment on Dashboard" },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <i className={`ti ${f.icon}`} style={{ fontSize: 12, color: "#3b82f6" }} />
                <span style={{ fontSize: 11, color: COLORS.textDim, fontWeight: 500 }}>{f.label}</span>
              </div>
              <div style={{ fontSize: 10, color: COLORS.textMuted, marginLeft: 20 }}>{f.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
