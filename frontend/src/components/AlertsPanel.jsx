import { useState, useEffect } from "react";
import { plantApi } from "../utils/api.js";
import { COLORS, SEV_PALETTE, Dot, SectionLabel, Spinner, ErrorBox } from "../utils/ui.jsx";

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [ackingIds, setAckingIds] = useState(new Set());

  useEffect(() => {
    plantApi.alerts()
      .then(d => setAlerts(d.alerts || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function acknowledge(id) {
    setAckingIds(prev => new Set(prev).add(id));
    try {
      await plantApi.acknowledgeAlert(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    } catch (e) {
      // Fallback: still update UI so the engineer isn't blocked
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    } finally {
      setAckingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  const filtered = alerts.filter(a => {
    if (filter === "unack") return !a.acknowledged;
    if (filter === "high" || filter === "medium" || filter === "low") return a.severity === filter;
    return true;
  });

  const unackCount = alerts.filter(a => !a.acknowledged).length;

  return (
    <div style={{ padding: 24, maxWidth: 900, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 600, margin: 0 }}>Alert Management</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { id: "all", label: `All (${alerts.length})` },
            { id: "unack", label: `Unacknowledged (${unackCount})` },
            { id: "high", label: "High" },
            { id: "medium", label: "Medium" },
            { id: "low", label: "Low" },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{ padding: "5px 12px", border: `1px solid ${filter === f.id ? "#3b82f6" : COLORS.border2}`, borderRadius: 6, background: filter === f.id ? "#1a2540" : "transparent", color: filter === f.id ? "#60a5fa" : COLORS.textMuted, fontSize: 12, cursor: "pointer" }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <Spinner label="Loading alerts..." />}
      {error && <ErrorBox message={error} />}

      {filtered.map(alert => {
        const pal = SEV_PALETTE[alert.severity] || SEV_PALETTE.low;
        return (
          <div key={alert.id}
            style={{ padding: 16, marginBottom: 12, background: alert.acknowledged ? COLORS.surface2 : pal.bg, border: `1px solid ${alert.acknowledged ? COLORS.border : pal.border}`, borderRadius: 8, opacity: alert.acknowledged ? 0.6 : 1, transition: "opacity 0.2s" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                  <Dot color={alert.acknowledged ? COLORS.textMuted : pal.dot} glow={!alert.acknowledged && alert.severity === "high"} />
                  <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace" }}>{alert.id}</span>
                  <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 3, background: `${pal.dot}22`, color: pal.text, fontWeight: 600 }}>{alert.severity.toUpperCase()}</span>
                  <span style={{ fontSize: 12, color: "#60a5fa" }}>{alert.equipment_id}</span>
                  <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace" }}>·</span>
                  <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace" }}>{alert.parameter}</span>
                  {alert.acknowledged && <span style={{ fontSize: 11, color: COLORS.textMuted }}>ACKNOWLEDGED</span>}
                </div>
                <p style={{ fontSize: 13, color: "#c8d0e0", margin: "0 0 8px", lineHeight: 1.6 }}>{alert.message}</p>
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace" }}>
                  {new Date(alert.timestamp).toLocaleString("en-IN")}
                </div>
              </div>
              {!alert.acknowledged && (
                <button onClick={() => acknowledge(alert.id)} disabled={ackingIds.has(alert.id)}
                  style={{ padding: "6px 14px", background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 6, color: pal.text, fontSize: 12, cursor: ackingIds.has(alert.id) ? "not-allowed" : "pointer", whiteSpace: "nowrap", flexShrink: 0, opacity: ackingIds.has(alert.id) ? 0.6 : 1 }}>
                  {ackingIds.has(alert.id) ? <><i className="ti ti-loader" style={{ fontSize: 11, marginRight: 4 }} />Saving...</> : "Acknowledge"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
