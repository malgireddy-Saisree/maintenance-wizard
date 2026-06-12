import { useState, useEffect, useCallback } from "react";
import { COLORS } from "../utils/ui.jsx";

// Global toast state — exported so any component can trigger toasts
let _addToast = null;
export function toast(message, type = "info", duration = 5000) {
  if (_addToast) _addToast({ message, type, duration, id: Date.now() });
}

// Request browser notification permission on load
export function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

export function sendBrowserNotification(title, body, icon = "🔥") {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(`${icon} ${title}`, { body, icon: "/favicon.ico" });
  }
}

const TOAST_STYLES = {
  critical: { bg: "#450a0a", border: "#ef4444", text: "#fca5a5", icon: "ti-alert-triangle" },
  warning:  { bg: "#431407", border: "#f97316", text: "#fdba74", icon: "ti-alert-circle" },
  success:  { bg: "#052e16", border: "#22c55e", text: "#86efac", icon: "ti-circle-check" },
  info:     { bg: "#0f172a", border: "#3b82f6", text: "#93c5fd", icon: "ti-info-circle" },
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    setToasts(prev => [...prev.slice(-4), toast]); // max 5 toasts
    if (toast.duration) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, toast.duration);
    }
  }, []);

  useEffect(() => {
    _addToast = addToast;
    requestNotificationPermission();
    return () => { _addToast = null; };
  }, [addToast]);

  function dismiss(id) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  if (!toasts.length) return null;

  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20,
      zIndex: 9999, display: "flex", flexDirection: "column", gap: 8,
    }}>
      {toasts.map(t => {
        const sty = TOAST_STYLES[t.type] || TOAST_STYLES.info;
        return (
          <div key={t.id} style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "12px 14px", minWidth: 300, maxWidth: 420,
            background: sty.bg, border: `1px solid ${sty.border}`,
            borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            animation: "slideIn 0.2s ease",
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}>
            <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
            <i className={`ti ${sty.icon}`} style={{ fontSize: 16, color: sty.text, flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: sty.text, flex: 1, lineHeight: 1.5 }}>{t.message}</span>
            <button onClick={() => dismiss(t.id)}
              style={{ background: "none", border: "none", color: sty.text, cursor: "pointer", padding: 0, fontSize: 14, opacity: 0.7 }}>
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
