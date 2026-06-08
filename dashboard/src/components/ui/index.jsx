// Shared UI primitives used across the dashboard.
//
// Provides buttons, cards, form controls, modals, avatars, and toast notifications.
import { useState, useEffect } from "react";
import APP_CONFIG from "../../config/app.config.js";

const T = APP_CONFIG.theme;

// ── Button ─────────────────────────────────────────────────────────────────
// Reusable button component with configurable variants, sizes, and hover feedback.
export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  type = "button",
  fullWidth = false,
  style: extraStyle = {},
}) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    border: "none",
    borderRadius: 10,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    fontWeight: 600,
    transition: "opacity 0.15s, transform 0.1s",
    opacity: disabled ? 0.55 : 1,
    width: fullWidth ? "100%" : undefined,
    ...extraStyle,
  };
  const sizes = {
    sm: { fontSize: 12, padding: "6px 12px" },
    md: { fontSize: 14, padding: "10px 20px" },
    lg: { fontSize: 15, padding: "13px 26px" },
  };
  const variants = {
    primary: { background: T.primary, color: "#fff" },
    secondary: {
      background: T.primaryLight,
      color: T.primaryText,
      border: `1px solid ${T.primary}30`,
    },
    ghost: {
      background: "transparent",
      color: T.textSecondary,
      border: `1px solid ${T.cardBorder}`,
    },
    danger: {
      background: T.danger.bg,
      color: T.danger.text,
      border: `1px solid ${T.danger.dot}40`,
    },
    success: {
      background: T.success.bg,
      color: T.success.text,
      border: `1px solid ${T.success.dot}40`,
    },
    warning: {
      background: T.warning.bg,
      color: T.warning.text,
      border: `1px solid ${T.warning.dot}40`,
    },
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{ ...base, ...sizes[size], ...variants[variant] }}
      onMouseEnter={(e) =>
        !disabled && (e.currentTarget.style.opacity = "0.85")
      }
      onMouseLeave={(e) => !disabled && (e.currentTarget.style.opacity = "1")}
      onMouseDown={(e) =>
        !disabled && (e.currentTarget.style.transform = "scale(0.97)")
      }
      onMouseUp={(e) =>
        !disabled && (e.currentTarget.style.transform = "scale(1)")
      }
    >
      {children}
    </button>
  );
}

// ── Badge / Status ──────────────────────────────────────────────────────────
// Small badge used for role and status labels throughout the UI.
const STATUS_MAP = {
  ADMIN: T.info,
  AUTHOR: { bg: "#ede9fe", text: "#5b21b6", dot: "#7c3aed" },
  STUDENT: T.neutral,
  approved: T.success,
  APPROVED: T.success,
  pending: T.warning,
  PENDING: T.warning,
  blocked: T.danger,
  BLOCKED: T.danger,
  active: T.success,
  live: T.danger,
  upcoming: T.info,
  completed: T.neutral,
  sent: T.success,
  scheduled: T.info,
};

export function Badge({ label, customColors }) {
  const c = customColors ?? STATUS_MAP[label] ?? T.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: c.bg,
        color: c.text,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.05em",
        padding: "3px 10px",
        borderRadius: 999,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: c.dot,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}

// ── Card ───────────────────────────────────────────────────────────────────
// Surface container with standard background, border, and optional top accent.
export function Card({ children, style: s = {}, accentColor }) {
  return (
    <div
      style={{
        background: T.cardBg,
        border: `1px solid ${T.cardBorder}`,
        borderTop: accentColor
          ? `3px solid ${accentColor}`
          : `1px solid ${T.cardBorder}`,
        borderRadius: 16,
        ...s,
      }}
    >
      {children}
    </div>
  );
}

// ── Input ──────────────────────────────────────────────────────────────────
// Styled input field with optional label and error text.
export function Input({ label, error: err, style: s = {}, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...s }}>
      {label && (
        <label
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: T.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </label>
      )}
      <input
        style={{
          border: `1px solid ${err ? T.danger.dot : T.cardBorder}`,
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 14,
          fontFamily: "inherit",
          color: T.textPrimary,
          background: T.cardBg,
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
        }}
        onFocus={(e) => (e.target.style.borderColor = T.primary)}
        onBlur={(e) =>
          (e.target.style.borderColor = err ? T.danger.dot : T.cardBorder)
        }
        {...props}
      />
      {err && <span style={{ fontSize: 11, color: T.danger.text }}>{err}</span>}
    </div>
  );
}

// ── Textarea ───────────────────────────────────────────────────────────────
// Multi-line text field with label support.
export function Textarea({ label, style: s = {}, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...s }}>
      {label && (
        <label
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: T.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </label>
      )}
      <textarea
        style={{
          border: `1px solid ${T.cardBorder}`,
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 14,
          fontFamily: "inherit",
          color: T.textPrimary,
          background: T.cardBg,
          outline: "none",
          resize: "vertical",
          boxSizing: "border-box",
          minHeight: 80,
        }}
        onFocus={(e) => (e.target.style.borderColor = T.primary)}
        onBlur={(e) => (e.target.style.borderColor = T.cardBorder)}
        {...props}
      />
    </div>
  );
}

// ── Select ─────────────────────────────────────────────────────────────────
export function Select({ label, options, style: s = {}, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...s }}>
      {label && (
        <label
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: T.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </label>
      )}
      <select
        style={{
          border: `1px solid ${T.cardBorder}`,
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 14,
          fontFamily: "inherit",
          color: T.textPrimary,
          background: T.cardBg,
          outline: "none",
          width: "100%",
        }}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────
// Modal overlay for dialogs that blocks background interaction.
export function Modal({ open, onClose, title, children, width = 480 }) {
  if (!open) return null;
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15,23,42,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: T.cardBg,
          borderRadius: 20,
          padding: 32,
          width,
          maxWidth: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
              color: T.textPrimary,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: T.textMuted,
              fontSize: 22,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ size = 28, color }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `3px solid ${color || T.primaryLight}`,
        borderTopColor: color ? "rgba(255,255,255,0.4)" : T.primary,
        animation: "spin 0.75s linear infinite",
      }}
    />
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────────
export function Avatar({ name = "?", size = 36 }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: T.primaryLight,
        color: T.primaryText,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.36),
        fontWeight: 700,
      }}
    >
      {initials || "?"}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────
export function EmptyState({ icon = "📭", title = "Nothing here", subtitle }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: T.textPrimary,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 13, color: T.textMuted }}>{subtitle}</div>
      )}
    </div>
  );
}

// ── Toast notification ─────────────────────────────────────────────────────
let _setToasts = () => {};
export function setGlobalToast(fn) {
  _setToasts = fn;
}
export function toast(message, type = "success") {
  _setToasts((prev) => [...prev, { id: Date.now(), message, type }]);
}

// ── Toast notification system ──────────────────────────────────────────────
// Global toast container used to display transient success/error/info messages.
export function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    setGlobalToast(setToasts);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((prev) => prev.slice(1)), 3200);
    return () => clearTimeout(t);
  }, [toasts]);

  const typeStyle = {
    success: { bg: "#dcfce7", color: "#166534", border: "#bbf7d0" },
    error: { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
    info: { bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" },
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {toasts.map((t) => {
        const s = typeStyle[t.type] || typeStyle.info;
        return (
          <div
            key={t.id}
            style={{
              background: s.bg,
              color: s.color,
              border: `1px solid ${s.border}`,
              borderRadius: 12,
              padding: "12px 18px",
              fontSize: 13,
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              maxWidth: 320,
              animation: "slideIn 0.25s ease",
            }}
          >
            {t.message}
          </div>
        );
      })}
    </div>
  );
}
