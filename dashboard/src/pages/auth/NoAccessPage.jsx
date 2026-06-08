// Access denied page shown when the current account lacks required permissions.
//
// Explains the reason for denial and provides a logout button.
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { Button } from "../../components/ui/index.jsx";
import APP_CONFIG from "../../config/app.config.js";

const T = APP_CONFIG.theme;

export default function NoAccessPage() {
  const { profile, error, logout } = useAuth();
  const navigate = useNavigate();

  const title =
    profile?.role === "STUDENT"
      ? "Student Access Only"
      : "Access Not Available";
  const message =
    profile?.role === "STUDENT" ? (
      <>
        Hi <strong>{profile?.fullName || profile?.email}</strong> - your account
        has the <strong>Student</strong> role. This admin panel is only
        accessible to Admin and Author accounts.
      </>
    ) : (
      error || "This account could not be matched to a backend admin profile."
    );

  // Sign out the user and return to the login page.
  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.sidebarBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#0f172a",
          border: `1px solid ${T.cardBorder}`,
          borderRadius: 24,
          padding: "32px 36px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            fontSize: 18,
            marginBottom: 16,
            fontWeight: 700,
            color: T.textMuted,
          }}
        >
          Access
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: T.textPrimary,
            margin: "0 0 10px",
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            color: T.textSecondary,
            fontSize: 14,
            lineHeight: 1.7,
            margin: "0 0 28px",
          }}
        >
          {message}
        </p>
        <p style={{ color: T.textMuted, fontSize: 13, margin: "0 0 28px" }}>
          If you believe this is a mistake, please contact your administrator or
          ensure your backend profile has been created.
        </p>
        <Button onClick={handleLogout} fullWidth variant="ghost">
          Sign Out
        </Button>
      </div>
    </div>
  );
}
