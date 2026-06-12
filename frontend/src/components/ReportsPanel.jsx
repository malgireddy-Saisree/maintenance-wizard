import { useState } from "react";
import { agentApi, plantApi } from "../utils/api.js";
import { COLORS, DOC_TYPE_COLORS, SectionLabel, Spinner, ErrorBox, Markdown } from "../utils/ui.jsx";

const REPORT_TYPES = [
  { id: "full_assessment", label: "Full Equipment Assessment", icon: "ti-report-analytics" },
  { id: "daily_shift",     label: "Daily Shift Handover",      icon: "ti-calendar-clock" },
  { id: "procurement",     label: "Spare Parts Procurement Advisory", icon: "ti-package" },
];

const EQUIPMENT_IDS = ["BF-01", "BOF-02", "CC-03", "RM-04", "HX-05", "CR-06"];

export default function ReportsPanel({ ragStatus }) {
  const [reportType, setReportType] = useState("full_assessment");
  const [equipmentId, setEquipmentId] = useState("RM-04");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function generate() {
    if (!ragStatus?.built) return;
    setGenerating(true);
    setResult(null);
    setError(null);
    try {
      const data = await agentApi.report(reportType, equipmentId);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  function download() {
    if (!result) return;
    const blob = new Blob([result.report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename || "maintenance-report.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  function markdownToHtml(md) {
    let h = md || '';
    h = h.split('\n## ').join('\n<h2>').split('\n### ').join('\n<h3>');
    h = h.split('\n# ').join('\n<h1>');
    h = h.split('\n- ').join('\n<li>');
    h = h.split('\n').join('<br/>');
    return h;
  }

  function printAsPDF() {
    if (!result) return;
    const html = markdownToHtml(result.report);
    const date = new Date().toLocaleString('en-IN');
    const fname = result.filename || 'maintenance-report';
    const win = window.open('', '_blank');
    const css = 'body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#111;line-height:1.6}' +
      'h1,h2{color:#1d4ed8;border-bottom:1px solid #ddd;padding-bottom:6px}' +
      '.hdr{background:#1e3a5f;color:white;padding:16px;border-radius:6px;margin-bottom:20px}' +
      '.ftr{margin-top:32px;border-top:1px solid #ddd;font-size:11px;color:#666;padding-top:10px}';
    win.document.write(
      '<!DOCTYPE html><html><head><title>' + fname + '</title>' +
      '<style>' + css + '</style></head><body>' +
      '<div class="hdr"><h1 style="color:white;border:none">Maintenance Wizard — Tata Steel</h1>' +
      '<p>Generated: ' + date + '</p></div>' +
      '<div>' + html + '</div>' +
      '<div class="ftr">Maintenance Wizard v3.0 | Tata Steel AI Hackathon 2026 | Azure OpenAI GPT-4o + RAG</div>' +
      '</body></html>'
    );
    win.document.close();
    setTimeout(function(){ win.print(); }, 500);
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 600, margin: 0 }}>Report Generation</h2>
        <div style={{ padding: "3px 10px", borderRadius: 10, fontSize: 10, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 5, background: ragStatus?.built ? "#052e16" : "#1a1a2e", border: `1px solid ${ragStatus?.built ? "#166534" : "#2a3a52"}`, color: ragStatus?.built ? "#4ade80" : "#64748b" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: ragStatus?.built ? "#22c55e" : "#4a5568" }} />
          {ragStatus?.built ? `RAG active — ${ragStatus.chunk_count} chunks` : "RAG index not built"}
        </div>
      </div>

      {/* Config */}
      <div style={{ padding: 16, marginBottom: 20, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
        <SectionLabel>Report Configuration</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: COLORS.textMuted, marginBottom: 5 }}>Report Type</label>
            <select value={reportType} onChange={e => setReportType(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", background: "#161c2d", border: `1px solid ${COLORS.border2}`, borderRadius: 6, color: COLORS.text, fontSize: 13 }}>
              {REPORT_TYPES.map(rt => <option key={rt.id} value={rt.id}>{rt.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: COLORS.textMuted, marginBottom: 5 }}>Equipment Focus</label>
            <select value={equipmentId} onChange={e => setEquipmentId(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", background: "#161c2d", border: `1px solid ${COLORS.border2}`, borderRadius: 6, color: COLORS.text, fontSize: 13 }}>
              {EQUIPMENT_IDS.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <button onClick={generate} disabled={!ragStatus?.built || generating}
            style={{ padding: "8px 20px", background: ragStatus?.built ? "#1d4ed8" : "#1e2938", border: "none", borderRadius: 6, color: ragStatus?.built ? "#fff" : COLORS.textMuted, fontSize: 13, cursor: ragStatus?.built ? "pointer" : "not-allowed", fontWeight: 500, display: "flex", alignItems: "center", gap: 6, height: 38 }}>
            <i className={`ti ${generating ? "ti-loader" : "ti-sparkles"}`} style={{ fontSize: 14 }} />
            {generating ? "Generating..." : "Generate"}
          </button>
        </div>
        {!ragStatus?.built && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#f59e0b", display: "flex", gap: 6 }}>
            <i className="ti ti-info-circle" style={{ fontSize: 13 }} />
            Build the RAG index first to enable AI-powered report generation.
          </div>
        )}
      </div>

      {generating && (
        <div style={{ padding: 40, textAlign: "center" }}>
          <i className="ti ti-sparkles" style={{ fontSize: 28, color: "#3b82f6", display: "block", marginBottom: 12 }} />
          <div style={{ color: COLORS.textMuted, fontSize: 14 }}>Retrieving relevant documents and generating report...</div>
        </div>
      )}

      {error && <ErrorBox message={error} />}

      {result && !generating && (
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
          {/* Report header */}
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: COLORS.textMuted }}>
              Generated {new Date().toLocaleString("en-IN")} · RAG-grounded · {result.filename}
            </span>
            <button onClick={download}
              style={{ padding: "5px 12px", background: "transparent", border: `1px solid ${COLORS.border2}`, borderRadius: 6, color: "#60a5fa", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <i className="ti ti-download" style={{ fontSize: 12 }} /> Download .md
            </button>
            <button onClick={printAsPDF}
              style={{ padding: "5px 12px", background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 6, color: "#f97316", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <i className="ti ti-printer" style={{ fontSize: 12 }} /> Print / PDF
            </button>
          </div>

          {/* Retrieved sources */}
          {result.sources?.length > 0 && (
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${COLORS.border}`, background: "#0a0e14" }}>
              <SectionLabel>Retrieved Sources ({result.sources.length})</SectionLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.sources.map((s, i) => (
                  <div key={s.chunk_id}
                    style={{ padding: "3px 10px", borderRadius: 4, fontSize: 11, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#60a5fa", fontFamily: "monospace" }}>[{i + 1}]</span>
                    <span style={{ color: COLORS.textDim }}>{s.title.slice(0, 45)}{s.title.length > 45 ? "..." : ""}</span>
                    <span style={{ color: COLORS.textMuted, fontFamily: "monospace" }}>{(s.score * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Report body */}
          <div style={{ padding: "16px 20px", maxHeight: 600, overflowY: "auto" }}>
            <Markdown text={result.report} />
          </div>
        </div>
      )}
    </div>
  );
}
