import { Button, Avatar, Spinner, Badge } from "../ui/index.jsx";
import APP_CONFIG from "../../config/app.config.js";

const T = APP_CONFIG.theme;

const FIELD = ({ label, value }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted,
      textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
      {label}
    </div>
    <div style={{ fontSize: 14, color: T.textPrimary, wordBreak: "break-word" }}>
      {value || <span style={{ color: T.textMuted }}>—</span>}
    </div>
  </div>
);

export default function UserDetailModal({ user, loading, onClose, onAction }) {
  function status() {
    if (user.blocked) return "BLOCKED";
    if (user.approved) return "APPROVED";
    return "PENDING";
  }
  const s = status();

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      {/* Modal panel — stop click propagation so backdrop click still closes */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.cardBg, border: `1px solid ${T.cardBorder}`,
          borderRadius: 20, width: "100%", maxWidth: 520,
          maxHeight: "85vh", overflowY: "auto",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "20px 24px 0",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted,
            textTransform: "uppercase", letterSpacing: "0.1em" }}>
            User Details
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: T.textMuted,
              fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Spinner size={32} />
          </div>
        ) : (
          <div style={{ padding: "20px 24px 24px" }}>
            {/* Avatar + name hero */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28,
              paddingBottom: 24, borderBottom: `1px solid ${T.cardBorder}` }}>
              <Avatar name={user.fullName || user.email} size={56} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.textPrimary,
                  letterSpacing: "-0.02em" }}>
                  {user.fullName || "—"}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                  {user.email}
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                  <Badge label={user.role || "STUDENT"} />
                  <Badge label={s} />
                </div>
              </div>
            </div>

            {/* Fields grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
              <FIELD label="User ID" value={user.id} />
              <FIELD label="College" value={user.collegeName} />
              <FIELD label="Phone" value={user.phone} />
              <FIELD label="Joined" value={user.createdAt
                ? new Date(user.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric"
                  })
                : null}
              />
              {user.bio && <FIELD label="Bio" value={user.bio} />}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 24,
              paddingTop: 20, borderTop: `1px solid ${T.cardBorder}` }}>
              {s === "PENDING" && <>
                <Button variant="success" onClick={() => onAction(user.id, "approve")}>
                  Approve
                </Button>
                <Button variant="danger" onClick={() => onAction(user.id, "block")}>
                  Block
                </Button>
              </>}
              {s === "APPROVED" &&
                <Button variant="warning" onClick={() => onAction(user.id, "block")}>
                  Block User
                </Button>
              }
              {s === "BLOCKED" &&
                <Button variant="success" onClick={() => onAction(user.id, "unblock")}>
                  Unblock User
                </Button>
              }
              <Button variant="ghost" onClick={onClose} style={{ marginLeft: "auto" }}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}