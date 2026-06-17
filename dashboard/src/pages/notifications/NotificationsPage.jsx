// Full notification console for admins.
// Compose, schedule, and target push notifications. View send history.
import { useState, useEffect, useCallback } from "react";
import { groupsApi } from "../../services/api.service.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  Button,
  Card,
  Input,
  Textarea,
  Modal,
  Badge,
  Spinner,
  EmptyState,
  toast,
} from "../../components/ui/index.jsx";
import APP_CONFIG from "../../config/app.config.js";

const T = APP_CONFIG.theme;
const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// ── API helpers (uses same pattern as api.service.js) ──────────────────────

async function notifRequest(method, path, body, getToken) {
  const token = await getToken();
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const raw = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { message: raw };
  }
  if (!res.ok)
    throw { status: res.status, message: parsed?.message || "Request failed" };
  return parsed?.data ?? parsed;
}

// ── Constants ──────────────────────────────────────────────────────────────

const NOTIF_TYPES = [
  { value: "ANNOUNCEMENT", label: "Announcement", color: T.info },
  { value: "QUIZ_REMINDER", label: "Quiz Reminder", color: T.success },
  { value: "CONTEST", label: "Contest Alert", color: T.warning },
  { value: "RESULT", label: "Result", color: T.neutral },
];

const TARGET_TYPES = [
  {
    value: "ALL",
    label: "All Users",
    desc: "Every registered user on the platform",
  },
  // { value: "APPROVED_ONLY", label: "Approved Only", desc: "Only fully verified accounts" },
  {
    value: "GROUP",
    label: "Specific Group",
    desc: "Target one student group/pool",
  },
];

const STATUS_COLORS = {
  SENT: T.success,
  PENDING: T.warning,
  FAILED: T.danger,
};

// ── Compose Modal ──────────────────────────────────────────────────────────

function ComposeModal({ open, onClose, groups, onSent, getToken }) {
  const [form, setForm] = useState({
    title: "",
    body: "",
    type: "ANNOUNCEMENT",
    targetType: "ALL",
    groupId: "",
    sendAt: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({
        title: "",
        body: "",
        type: "ANNOUNCEMENT",
        targetType: "ALL",
        groupId: "",
        sendAt: "",
      });
      setError("");
    }
  }, [open]);

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  async function handleSend() {
    if (!form.title.trim()) return setError("Title is required.");
    if (!form.body.trim()) return setError("Body is required.");
    if (form.targetType === "GROUP" && !form.groupId)
      return setError("Please select a group.");

    setLoading(true);
    setError("");
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        type: form.type,
        targetType: form.targetType,
        ...(form.targetType === "GROUP" && { groupId: form.groupId }),
        ...(form.sendAt && { sendAt: new Date(form.sendAt).toISOString() }),
      };
      await notifRequest("POST", "/notifications/send", payload, getToken);
      toast(
        form.sendAt ? "Notification scheduled!" : "Notification sent!",
        "success",
      );
      onSent();
      onClose();
    } catch (e) {
      setError(e.message || "Failed to send notification.");
    } finally {
      setLoading(false);
    }
  }

  const isScheduled = !!form.sendAt;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Compose Notification"
      width={560}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Title */}
        <div>
          <label style={labelStyle}>Title *</label>
          <Input
            placeholder="e.g. Daily Quiz #15 starts in 30 minutes!"
            value={form.title}
            onChange={set("title")}
          />
        </div>

        {/* Body */}
        <div>
          <label style={labelStyle}>Body *</label>
          <Textarea
            placeholder="Notification message shown to users..."
            value={form.body}
            onChange={set("body")}
            rows={3}
          />
        </div>

        {/* Type + Target in a row */}
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div>
            <label style={labelStyle}>Type</label>
            <select
              style={selectStyle}
              value={form.type}
              onChange={set("type")}
            >
              {NOTIF_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Target Audience</label>
            <select
              style={selectStyle}
              value={form.targetType}
              onChange={set("targetType")}
            >
              {TARGET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Target description hint */}
        <p style={{ margin: "-8px 0 0", fontSize: 12, color: T.textMuted }}>
          {TARGET_TYPES.find((t) => t.value === form.targetType)?.desc}
        </p>

        {/* Group picker — only when GROUP is selected */}
        {form.targetType === "GROUP" && (
          <div>
            <label style={labelStyle}>Select Group *</label>
            <select
              style={selectStyle}
              value={form.groupId}
              onChange={set("groupId")}
            >
              <option value="">— choose a group —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g._count?.members ?? 0} members)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Schedule picker */}
        <div>
          <label style={labelStyle}>
            Schedule for later{" "}
            <span style={{ color: T.textMuted, fontWeight: 400 }}>
              (leave blank to send immediately)
            </span>
          </label>
          <input
            type="datetime-local"
            value={form.sendAt}
            onChange={set("sendAt")}
            style={{
              ...inputBase,
              colorScheme: "dark",
            }}
          />
        </div>

        {/* Preview panel */}
        {(form.title || form.body) && (
          <div
            style={{
              background: T.pageBg,
              border: `1px solid ${T.cardBorder}`,
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            <p
              style={{
                fontSize: 11,
                color: T.textMuted,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Preview
            </p>
            <p
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: T.textPrimary,
                margin: "0 0 4px",
              }}
            >
              {form.title || "Your title here"}
            </p>
            <p style={{ fontSize: 12, color: T.textSecondary, margin: 0 }}>
              {form.body || "Your message here"}
            </p>
          </div>
        )}

        {error && (
          <p
            style={{
              fontSize: 13,
              color: T.danger.text,
              background: T.danger.bg,
              padding: "8px 12px",
              borderRadius: 8,
              margin: 0,
            }}
          >
            {error}
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            paddingTop: 4,
          }}
        >
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={loading}>
            {loading ? (
              <Spinner size={14} />
            ) : isScheduled ? (
              "⏰ Schedule"
            ) : (
              "Send Now →"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── History row ────────────────────────────────────────────────────────────

function HistoryRow({ notif }) {
  const typeInfo =
    NOTIF_TYPES.find((t) => t.value === notif.type) ?? NOTIF_TYPES[0];
  const statusColors = STATUS_COLORS[notif.status] ?? T.neutral;

  const sentTime = notif.sentAt
    ? new Date(notif.sentAt).toLocaleString()
    : notif.sendAt
      ? `Scheduled: ${new Date(notif.sendAt).toLocaleString()}`
      : "—";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "14px 16px",
        borderBottom: `1px solid ${T.cardBorder}`,
      }}
    >
      {/* Type dot */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: typeInfo.color.dot,
          marginTop: 6,
          flexShrink: 0,
        }}
      />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 3,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
            {notif.title}
          </span>
          <Badge
            label={notif.type.replace("_", " ")}
            customColors={typeInfo.color}
          />
        </div>
        <p
          style={{
            fontSize: 13,
            color: T.textSecondary,
            margin: "0 0 6px",
            lineHeight: 1.4,
          }}
        >
          {notif.body}
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: T.textMuted }}>{sentTime}</span>
          <span style={{ fontSize: 11, color: T.textMuted }}>·</span>
          <span style={{ fontSize: 11, color: T.textMuted }}>
            Target: {notif.targetType.replace("_", " ")}
          </span>
          {notif.createdBy && (
            <>
              <span style={{ fontSize: 11, color: T.textMuted }}>·</span>
              <span style={{ fontSize: 11, color: T.textMuted }}>
                By {notif.createdBy.fullName || notif.createdBy.email}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Status badge */}
      <Badge label={notif.status} customColors={statusColors} />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { firebaseUser } = useAuth();
  const [groups, setGroups] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);

  const getToken = useCallback(async () => {
    if (!firebaseUser) throw new Error("Not authenticated");
    return firebaseUser.getIdToken();
  }, [firebaseUser]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await notifRequest("GET", "/notifications", null, getToken);
      setHistory(Array.isArray(data) ? data : []);
    } catch (e) {
      toast(e.message || "Failed to load notifications", "error");
    } finally {
      setHistoryLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadHistory();
    groupsApi
      .getAll()
      .then(setGroups)
      .catch(() => {});
  }, [loadHistory]);

  const pendingCount = history.filter((n) => n.status === "PENDING").length;
  const sentCount = history.filter((n) => n.status === "SENT").length;

  return (
    <div style={{ padding: "32px 40px", maxWidth: 900 }}>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: T.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Admin · Notification System
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: T.textPrimary,
              margin: "4px 0 0",
              letterSpacing: "-0.03em",
            }}
          >
            Notifications
          </h1>
        </div>
        <Button onClick={() => setComposeOpen(true)}>+ Compose</Button>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {[
          { label: "Total Sent", value: sentCount, color: T.success },
          { label: "Scheduled", value: pendingCount, color: T.warning },
          { label: "Total", value: history.length, color: T.info },
        ].map((s) => (
          <Card key={s.label} style={{ padding: "16px 20px" }}>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: s.color.text,
                letterSpacing: "-0.04em",
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
              {s.label}
            </div>
          </Card>
        ))}
      </div>

      {/* History */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "14px 16px",
            borderBottom: `1px solid ${T.cardBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>
            Send History
          </span>
          <button
            onClick={loadHistory}
            style={{
              background: "none",
              border: "none",
              color: T.textMuted,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {historyLoading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Spinner />
          </div>
        ) : history.length === 0 ? (
          <EmptyState
            icon="◎"
            title="No notifications sent yet"
            description="Compose your first notification to send quiz reminders or announcements to students."
          />
        ) : (
          history.map((n) => <HistoryRow key={n.id} notif={n} />)
        )}
      </Card>

      {/* Compose modal */}
      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        groups={groups}
        onSent={loadHistory}
        getToken={getToken}
      />
    </div>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: T.textSecondary,
  marginBottom: 6,
};

const inputBase = {
  width: "100%",
  background: T.pageBg,
  border: `1px solid ${T.cardBorder}`,
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 14,
  color: T.textPrimary,
  fontFamily: "inherit",
  boxSizing: "border-box",
  outline: "none",
};

const selectStyle = {
  ...inputBase,
  cursor: "pointer",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2394a3b8' d='M6 8L0 0h12z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: 32,
};
