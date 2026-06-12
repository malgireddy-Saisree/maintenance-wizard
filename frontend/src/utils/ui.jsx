// src/utils/ui.js — shared constants and tiny components

export const COLORS = {
  bg:       "#0a0e14",
  surface:  "#0d1117",
  surface2: "#111827",
  border:   "#1e2938",
  border2:  "#2a3a52",
  text:     "#e8eaf0",
  textDim:  "#8892a4",
  textMuted:"#4a5568",
  accent:   "#3b82f6",
  orange:   "#e85d04",
};

export const RISK_PALETTE = {
  Critical: { bg: "#450a0a", border: "#ef4444", text: "#fca5a5", dot: "#ef4444" },
  High:     { bg: "#431407", border: "#f97316", text: "#fdba74", dot: "#f97316" },
  Medium:   { bg: "#422006", border: "#f59e0b", text: "#fcd34d", dot: "#f59e0b" },
  Low:      { bg: "#052e16", border: "#22c55e", text: "#86efac", dot: "#22c55e" },
  Unknown:  { bg: "#1e2938", border: "#4a5568", text: "#8892a4", dot: "#4a5568" },
  warning:  { bg: "#431407", border: "#f97316", text: "#fdba74", dot: "#f97316" },
  normal:   { bg: "#052e16", border: "#22c55e", text: "#86efac", dot: "#22c55e" },
};

export const DOC_TYPE_COLORS = {
  manual:             "#3b82f6",
  sop:                "#22c55e",
  failure_report:     "#ef4444",
  maintenance_record: "#f59e0b",
  technical_bulletin: "#a78bfa",
};

export const SEV_PALETTE = {
  high:     { bg: "#431407", border: "#7c2d12", text: "#fdba74", dot: "#f97316" },
  medium:   { bg: "#422006", border: "#78350f", text: "#fcd34d", dot: "#f59e0b" },
  low:      { bg: "#052e16", border: "#14532d", text: "#86efac", dot: "#22c55e" },
  critical: { bg: "#450a0a", border: "#7f1d1d", text: "#fca5a5", dot: "#ef4444" },
};

// ── Tiny shared components ─────────────────────────────────────────────────

export function Badge({ label, color, bg, border }) {
  return (
    <span style={{
      fontSize: 10, padding: "1px 7px", borderRadius: 3, fontFamily: "monospace",
      background: bg || `${color}22`, color: color,
      border: `1px solid ${border || color + "44"}`,
      textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em",
    }}>
      {label}
    </span>
  );
}

export function Dot({ color, glow = false }) {
  return (
    <div style={{
      width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0,
      boxShadow: glow ? `0 0 6px ${color}` : "none",
    }} />
  );
}

export function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, color: COLORS.textMuted, letterSpacing: "0.1em",
      textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

export function ErrorBox({ message }) {
  return (
    <div style={{
      padding: "10px 14px", background: "#450a0a", border: "1px solid #7f1d1d",
      borderRadius: 6, fontSize: 12, color: "#fca5a5",
      display: "flex", gap: 8, alignItems: "flex-start",
    }}>
      <i className="ti ti-alert-circle" style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }} />
      <span>{message}</span>
    </div>
  );
}

export function Spinner({ label = "Loading..." }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: COLORS.textDim, fontSize: 13 }}>
      <i className="ti ti-loader" style={{ fontSize: 16, color: COLORS.accent }} />
      {label}
    </div>
  );
}

export function SourcesPanel({ sources = [] }) {
  if (!sources.length) return null;
  return (
    <div style={{
      marginTop: 8, padding: "8px 10px", background: "#0a0e14",
      borderRadius: 6, border: `1px solid ${COLORS.border}`,
    }}>
      <SectionLabel>Retrieved Sources ({sources.length})</SectionLabel>
      {sources.map((s, i) => (
        <div key={s.chunk_id} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 5 }}>
          <span style={{
            fontSize: 10, padding: "1px 5px", borderRadius: 3, flexShrink: 0,
            background: `${DOC_TYPE_COLORS[s.doc_type] || "#4a5568"}22`,
            color: DOC_TYPE_COLORS[s.doc_type] || "#8892a4",
            fontFamily: "monospace", border: `1px solid ${DOC_TYPE_COLORS[s.doc_type] || "#4a5568"}44`,
          }}>
            [{i + 1}] {s.doc_type}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: COLORS.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.title}
            </div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: "monospace" }}>
              score: {(s.score * 100).toFixed(1)}% · {s.equipment_id || "General"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Markdown renderer — handles headings, lists, bold, inline code, [SOURCE N] citations
export function Markdown({ text }) {
  function renderInline(line) {
    return line.split(/(\*\*[^*]+\*\*|`[^`]+`|\[SOURCE \d+\])/g).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={i} style={{ color: COLORS.text }}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`"))
        return <code key={i} style={{ background: "#1e2938", padding: "0 4px", borderRadius: 3, fontFamily: "monospace", fontSize: 12, color: "#93c5fd" }}>{part.slice(1, -1)}</code>;
      if (/^\[SOURCE \d+\]$/.test(part))
        return <span key={i} style={{ background: "#1a2540", color: "#60a5fa", fontSize: 11, padding: "0 5px", borderRadius: 3, fontFamily: "monospace", border: "1px solid #2a3a52" }}>{part}</span>;
      return part;
    });
  }

  return (
    <div style={{ fontSize: 13, lineHeight: 1.75, color: "#c8d0e0", fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## "))
          return <h3 key={i} style={{ color: "#60a5fa", fontSize: 14, fontWeight: 600, margin: "14px 0 6px", borderBottom: "1px solid #1e2938", paddingBottom: 4 }}>{line.slice(3)}</h3>;
        if (line.startsWith("### "))
          return <h4 key={i} style={{ color: "#93c5fd", fontSize: 13, fontWeight: 600, margin: "10px 0 4px" }}>{line.slice(4)}</h4>;
        if (line.startsWith("# "))
          return <h2 key={i} style={{ color: "#e8eaf0", fontSize: 16, fontWeight: 600, margin: "16px 0 8px" }}>{line.slice(2)}</h2>;
        const bullet = line.match(/^[-•] (.+)/);
        if (bullet)
          return <div key={i} style={{ paddingLeft: 16, marginBottom: 2, display: "flex", gap: 6 }}><span style={{ color: "#4a5568" }}>›</span><span>{renderInline(bullet[1])}</span></div>;
        const num = line.match(/^(\d+)\. (.+)/);
        if (num)
          return <div key={i} style={{ paddingLeft: 16, marginBottom: 3, display: "flex", gap: 6 }}><span style={{ color: "#60a5fa", minWidth: 18, fontFamily: "monospace", fontSize: 11 }}>{num[1]}.</span><span>{renderInline(num[2])}</span></div>;
        if (line === "") return <div key={i} style={{ height: 8 }} />;
        return <div key={i} style={{ marginBottom: 2 }}>{renderInline(line)}</div>;
      })}
    </div>
  );
}
