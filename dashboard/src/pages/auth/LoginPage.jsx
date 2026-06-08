// Login and signup page for the dashboard.
//
// Handles sign-in, account creation, and password reset flows in one reusable form.
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { Button, Input, Select, Spinner } from "../../components/ui/index.jsx";
import APP_CONFIG from "../../config/app.config.js";

const T = APP_CONFIG.theme;

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("Male");
  const [collegeName, setCollegeName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const { login, signup, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  // Convert Firebase error codes into friendly messages for users.
  function friendlyError(err) {
    const map = {
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect password.",
      "auth/invalid-credential": "Invalid email or password.",
      "auth/email-already-in-use": "An account with this email already exists.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/too-many-requests": "Too many attempts. Please try again later.",
    };
    return (
      map[err?.code] ||
      err?.message ||
      "Something went wrong. Please try again."
    );
  }

  // Main form submission handler for login/signup/reset mode.
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (mode === "reset") {
      setLoading(true);
      try {
        await resetPassword(email);
        setResetSent(true);
      } catch (err) {
        setError(friendlyError(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === "signup" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (
      mode === "signup" &&
      (!fullName.trim() || !collegeName.trim() || !rollNumber.trim())
    ) {
      setError("Please complete all profile fields.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password, {
          fullName: fullName.trim(),
          gender,
          collegeName: collegeName.trim(),
          rollNumber: rollNumber.trim(),
        });
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  const titles = {
    login: "Welcome back",
    signup: "Create account",
    reset: "Reset password",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.sidebarBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <div
        style={{
          position: "fixed",
          inset: 0,
          opacity: 0.04,
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          pointerEvents: "none",
        }}
      />

      <div style={{ width: "100%", maxWidth: 420, position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img
            src={APP_CONFIG.logo}
            alt={`${APP_CONFIG.name} logo`}
            style={{
              width: 60,
              height: 60,
              flexShrink: 0,
              objectFit: "contain",
              background: "transparent",
            }}
          />
          <div
            style={{
              color: "#f1f5f9",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-0.03em",
            }}
          >
            {APP_CONFIG.name}
          </div>
          <div
            style={{
              color: "#475569",
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginTop: 4,
            }}
          >
            {APP_CONFIG.tagline}
          </div>
        </div>

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
          <h1
            style={{
              margin: "0 0 24px",
              fontSize: 20,
              fontWeight: 800,
              color: T.textPrimary,
              letterSpacing: "-0.02em",
            }}
          >
            {titles[mode]}
          </h1>

          {resetSent ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>Mail</div>
              <p
                style={{
                  color: T.textSecondary,
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                Check your inbox - we've sent a password reset link to{" "}
                <strong>{email}</strong>.
              </p>
              <Button
                onClick={() => {
                  setMode("login");
                  setResetSent(false);
                }}
                style={{ marginTop: 16 }}
                fullWidth
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />

              {mode !== "reset" && (
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
              )}

              {mode === "signup" && (
                <>
                  <Input
                    label="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    required
                  />
                  <Select
                    label="Gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    options={[
                      { value: "Male", label: "Male" },
                      { value: "Female", label: "Female" },
                      { value: "Other", label: "Other" },
                    ]}
                  />
                  <Input
                    label="College name"
                    value={collegeName}
                    onChange={(e) => setCollegeName(e.target.value)}
                    placeholder="Your college"
                    required
                  />
                  <Input
                    label="Roll number"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="Your roll number"
                    required
                  />
                  <Input
                    label="Confirm password"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Confirm password"
                    required
                  />
                </>
              )}

              {error && (
                <div
                  style={{
                    background: T.danger.bg,
                    color: T.danger.text,
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {error}
                </div>
              )}

              <Button type="submit" fullWidth disabled={loading} size="lg">
                {loading ? (
                  <Spinner size={18} color="rgba(255,255,255,0.7)" />
                ) : mode === "login" ? (
                  "Sign In"
                ) : mode === "signup" ? (
                  "Create Account"
                ) : (
                  "Send Reset Link"
                )}
              </Button>

              {mode === "login" && (
                <div style={{ textAlign: "center" }}>
                  <button
                    type="button"
                    onClick={() => setMode("reset")}
                    style={{
                      background: "none",
                      border: "none",
                      color: T.primary,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontWeight: 500,
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <div
                style={{
                  borderTop: `1px solid ${T.cardBorder}`,
                  paddingTop: 16,
                  textAlign: "center",
                }}
              >
                {mode === "login" ? (
                  <span style={{ fontSize: 13, color: T.textSecondary }}>
                    No account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      style={{
                        background: "none",
                        border: "none",
                        color: T.primary,
                        fontSize: 13,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontWeight: 600,
                      }}
                    >
                      Sign up
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    style={{
                      background: "none",
                      border: "none",
                      color: T.primary,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontWeight: 600,
                    }}
                  >
                    Back to sign in
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        <p
          style={{
            textAlign: "center",
            color: "#334155",
            fontSize: 11,
            marginTop: 20,
            letterSpacing: "0.04em",
          }}
        >
          {APP_CONFIG.org} · Admin Panel
        </p>
      </div>
    </div>
  );
}
