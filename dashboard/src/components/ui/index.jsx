// Shared UI primitives used across the dashboard.
//
// Provides buttons, cards, form controls, modals, avatars, and toast notifications.
import { useState, useEffect, useRef } from "react";
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
            display: "flex",
            alignItems: "flex-end",
            minHeight: 32,
            fontSize: 12,
            fontWeight: 700,
            color: T.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            boxSizing: "border-box",
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
            display: "flex",
            alignItems: "flex-end",
            minHeight: 32,
            fontSize: 12,
            fontWeight: 700,
            color: T.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            boxSizing: "border-box",
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

// ── DateTimePicker ───────────────────────────────────────────────────────
// Custom date + time picker styled to match the dashboard's dark theme.
// The native <input type="datetime-local"> renders an OS-level light-themed
// popup that can't be restyled, so this builds the calendar + time scroller
// from scratch using the same tokens as the rest of the UI.
//
// `value`    — string in "YYYY-MM-DDTHH:mm" form (same shape the native
//              input produces), or "" for no selection.
// `onChange` — called with a new value string of that same shape ("" to clear)
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function parseDateTimeValue(value) {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = (datePart || "").split("-").map(Number);
  const [hh, mm] = (timePart || "0:0").split(":").map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d, hour: hh || 0, minute: mm || 0 };
}

function buildDateTimeValue({ year, month, day, hour, minute }) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}`;
}

function formatDateTimeDisplay(value) {
  const parsed = parseDateTimeValue(value);
  if (!parsed) return "";
  const d = new Date(
    parsed.year,
    parsed.month,
    parsed.day,
    parsed.hour,
    parsed.minute,
  );
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Select date & time",
}) {
  const parsed = parseDateTimeValue(value);
  const today = new Date();

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());

  const wrapRef = useRef(null);
  const hourColRef = useRef(null);
  const minuteColRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // When opened, jump the calendar to whatever is currently selected and
  // scroll the time columns so the active hour/minute is in view.
  useEffect(() => {
    if (!open) return;
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
    requestAnimationFrame(() => {
      hourColRef.current
        ?.querySelector("[data-active='true']")
        ?.scrollIntoView({ block: "center" });
      minuteColRef.current
        ?.querySelector("[data-active='true']")
        ?.scrollIntoView({ block: "center" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const activeHour24 = parsed?.hour ?? today.getHours();
  const activeMinute = parsed?.minute ?? today.getMinutes();
  const isPM = activeHour24 >= 12;
  const activeHour12 = ((activeHour24 + 11) % 12) + 1;

  function commit(next) {
    onChange(buildDateTimeValue(next));
  }

  function fallbackDate() {
    // The date part to use when only a time control has been touched so far.
    return parsed
      ? { year: parsed.year, month: parsed.month, day: parsed.day }
      : {
          year: today.getFullYear(),
          month: today.getMonth(),
          day: today.getDate(),
        };
  }

  function handlePickDay(day) {
    commit({
      year: viewYear,
      month: viewMonth,
      day,
      hour: activeHour24,
      minute: activeMinute,
    });
  }

  function handlePickHour12(h12) {
    let hour24 = h12 % 12;
    if (isPM) hour24 += 12;
    commit({ ...fallbackDate(), hour: hour24, minute: activeMinute });
  }

  function handlePickMinute(minute) {
    commit({ ...fallbackDate(), hour: activeHour24, minute });
  }

  function handlePickAmPm(pm) {
    let hour24 = activeHour24 % 12;
    if (pm) hour24 += 12;
    commit({ ...fallbackDate(), hour: hour24, minute: activeMinute });
  }

  function stepMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  function goToday() {
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
    commit({
      year: today.getFullYear(),
      month: today.getMonth(),
      day: today.getDate(),
      hour: activeHour24,
      minute: activeMinute,
    });
  }

  // Build a 6-row (42 cell) calendar grid for the viewed month.
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ day: daysInPrevMonth - firstWeekday + 1 + i, current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, current: true });
  let trailing = 1;
  while (cells.length < 42) cells.push({ day: trailing++, current: false });

  const isSelectedCell = (c) =>
    c.current &&
    parsed &&
    parsed.year === viewYear &&
    parsed.month === viewMonth &&
    parsed.day === c.day;
  const isTodayCell = (c) =>
    c.current &&
    viewYear === today.getFullYear() &&
    viewMonth === today.getMonth() &&
    c.day === today.getDate();

  function renderTimeColumn({
    ref,
    items,
    activeValue,
    formatLabel,
    onSelect,
  }) {
    return (
      <div
        ref={ref}
        style={{
          height: 168,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          paddingRight: 2,
          scrollbarWidth: "thin",
        }}
      >
        {items.map((item) => {
          const active = item === activeValue;
          return (
            <button
              key={item}
              type="button"
              data-active={active ? "true" : undefined}
              onClick={() => onSelect(item)}
              style={{
                minWidth: 38,
                border: "none",
                borderRadius: 8,
                padding: "5px 8px",
                fontSize: 12.5,
                fontWeight: active ? 800 : 500,
                fontFamily: "inherit",
                cursor: "pointer",
                background: active ? T.primary : "transparent",
                color: active ? "#0b1502" : T.textSecondary,
              }}
            >
              {formatLabel ? formatLabel(item) : item}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          ...inputBase,
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          color: value ? T.textPrimary : T.textMuted,
        }}
      >
        <span>{value ? formatDateTimeDisplay(value) : placeholder}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {value && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              style={{ color: T.textMuted, fontSize: 15, lineHeight: 1 }}
              title="Clear"
            >
              ×
            </span>
          )}
          <span style={{ color: T.textMuted, fontSize: 13 }}>📅</span>
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 30,
            background: T.cardBg,
            border: `1px solid ${T.cardBorder}`,
            borderRadius: 14,
            boxShadow: "0 25px 50px rgba(0,0,0,0.45)",
            padding: 16,
          }}
        >
          <div style={{ display: "flex", gap: 16 }}>
            {/* Calendar */}
            <div style={{ width: 232 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => stepMonth(-1)}
                  style={navBtnStyle}
                >
                  ‹
                </button>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: T.textPrimary,
                  }}
                >
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <button
                  type="button"
                  onClick={() => stepMonth(1)}
                  style={navBtnStyle}
                >
                  ›
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  marginBottom: 4,
                }}
              >
                {WEEKDAYS.map((w) => (
                  <div
                    key={w}
                    style={{
                      textAlign: "center",
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: T.textMuted,
                    }}
                  >
                    {w}
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  rowGap: 2,
                }}
              >
                {cells.map((c, i) => {
                  const selected = isSelectedCell(c);
                  const isToday = isTodayCell(c);
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!c.current}
                      onClick={() => handlePickDay(c.day)}
                      style={{
                        width: 30,
                        height: 30,
                        margin: "0 auto",
                        border:
                          isToday && !selected
                            ? `1px solid ${T.primary}`
                            : "none",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: selected ? 800 : 500,
                        fontFamily: "inherit",
                        cursor: c.current ? "pointer" : "default",
                        background: selected ? T.primary : "transparent",
                        color: selected
                          ? "#0b1502"
                          : c.current
                            ? T.textPrimary
                            : `${T.textMuted}80`,
                      }}
                    >
                      {c.day}
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: `1px solid ${T.cardBorder}`,
                }}
              >
                <button
                  type="button"
                  onClick={() => onChange("")}
                  style={linkBtnStyle}
                >
                  Clear
                </button>
                <button type="button" onClick={goToday} style={linkBtnStyle}>
                  Today
                </button>
              </div>
            </div>

            {/* Time */}
            <div
              style={{
                display: "flex",
                gap: 4,
                paddingLeft: 14,
                borderLeft: `1px solid ${T.cardBorder}`,
              }}
            >
              {renderTimeColumn({
                ref: hourColRef,
                items: Array.from({ length: 12 }, (_, i) => i + 1),
                activeValue: activeHour12,
                formatLabel: (h) => pad2(h),
                onSelect: handlePickHour12,
              })}
              {renderTimeColumn({
                ref: minuteColRef,
                items: Array.from({ length: 60 }, (_, i) => i),
                activeValue: activeMinute,
                formatLabel: (m) => pad2(m),
                onSelect: handlePickMinute,
              })}
              {renderTimeColumn({
                items: ["AM", "PM"],
                activeValue: isPM ? "PM" : "AM",
                onSelect: (v) => handlePickAmPm(v === "PM"),
              })}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 14,
              paddingTop: 12,
              borderTop: `1px solid ${T.cardBorder}`,
            }}
          >
            <Button size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputBase = {
  width: "100%",
  background: T.pageBg,
  border: `1px solid ${T.cardBorder}`,
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 14,
  color: T.textPrimary,
  fontFamily: "inherit",
  boxSizing: "border-box",
  outline: "none",
};

const navBtnStyle = {
  background: "none",
  border: "none",
  color: T.textSecondary,
  fontSize: 16,
  cursor: "pointer",
  padding: "2px 8px",
  borderRadius: 6,
  fontFamily: "inherit",
};

const linkBtnStyle = {
  background: "none",
  border: "none",
  color: T.primary,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  padding: 0,
  fontFamily: "inherit",
};

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
