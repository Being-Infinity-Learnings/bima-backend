// Login page for the dashboard — Phone + OTP flow.
//
// Step 1: Enter phone number → send OTP via Firebase Phone Auth
// Step 2: Enter OTP → verify with Firebase → check backend profile
//   • Profile found, role ADMIN/AUTHOR → navigate to dashboard
//   • Profile found, role STUDENT       → navigate to /no-access
//   • No profile (new user)             → proceed to Step 3
// Step 3: Enter profile details → register backend account → navigate to dashboard
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createRecaptchaVerifier } from "../../config/firebase.config.js";
import { Button, Input, Select, Spinner } from "../../components/ui/index.jsx";
import APP_CONFIG from "../../config/app.config.js";

const T = APP_CONFIG.theme;

// ─── tiny helpers ────────────────────────────────────────────────────────────

// Combine selected dial code with the raw number digits the user typed.
function formatPhone(dialCode, raw) {
  const digits = raw.replace(/[\s\-()]/g, "");
  return dialCode + digits;
}

function friendlyError(err) {
  const map = {
    "auth/invalid-phone-number": "Enter a valid phone number.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/invalid-verification-code": "Incorrect OTP. Please try again.",
    "auth/code-expired": "OTP expired. Please request a new one.",
    "auth/missing-phone-number": "Phone number is required.",
    "auth/quota-exceeded": "SMS quota exceeded. Try later.",
    "auth/captcha-check-failed": "reCAPTCHA check failed. Refresh and retry.",
  };
  return (
    map[err?.code] || err?.message || "Something went wrong. Please try again."
  );
}

// ─── country dial codes ───────────────────────────────────────────────────────

const COUNTRIES = [
  { code: "IN", name: "India", dial: "+91" },
  { code: "US", name: "United States", dial: "+1" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "AE", name: "UAE", dial: "+971" },
  { code: "SG", name: "Singapore", dial: "+65" },
  { code: "AU", name: "Australia", dial: "+61" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "FR", name: "France", dial: "+33" },
  { code: "JP", name: "Japan", dial: "+81" },
  { code: "CN", name: "China", dial: "+86" },
  { code: "BR", name: "Brazil", dial: "+55" },
  { code: "NG", name: "Nigeria", dial: "+234" },
  { code: "PK", name: "Pakistan", dial: "+92" },
  { code: "BD", name: "Bangladesh", dial: "+880" },
  { code: "NP", name: "Nepal", dial: "+977" },
  { code: "LK", name: "Sri Lanka", dial: "+94" },
  { code: "ZA", name: "South Africa", dial: "+27" },
  { code: "KE", name: "Kenya", dial: "+254" },
  { code: "MY", name: "Malaysia", dial: "+60" },
];

function flag(code) {
  // Convert ISO country code to flag emoji using regional indicator symbols.
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  const steps = ["Phone", "OTP", "Profile"];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 28,
      }}
    >
      {steps.map((label, i) => {
        const idx = i + 1;
        const active = idx === step;
        const done = idx < step;
        return (
          <div
            key={label}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                opacity: done || active ? 1 : 0.35,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: done
                    ? T.primary
                    : active
                      ? T.primary
                      : T.cardBorder,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: done || active ? "#000" : T.textMuted,
                  flexShrink: 0,
                }}
              >
                {done ? "✓" : idx}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  color: active ? T.textPrimary : T.textMuted,
                }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  width: 24,
                  height: 1,
                  background: done ? T.primary : T.cardBorder,
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function LoginPage() {
  // step 1 = phone entry, 2 = otp entry, 3 = profile signup
  const [step, setStep] = useState(1);

  // step 1
  const [dialCode, setDialCode] = useState("+91");
  const [phone, setPhone] = useState("");

  // step 2
  const [otp, setOtp] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  // step 3
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("Male");
  const [collegeName, setCollegeName] = useState("");
  const [rollNumber, setRollNumber] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const verificationIdRef = useRef(null);
  const recaptchaRef = useRef(null);
  const countdownRef = useRef(null);

  const { sendOtp, verifyOtp, completeSignup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  // Cleanup countdown timer on unmount
  useEffect(() => () => clearInterval(countdownRef.current), []);

  function startCountdown(seconds = 30) {
    setResendCountdown(seconds);
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setResendCountdown((s) => {
        if (s <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function clearRecaptcha() {
    try {
      recaptchaRef.current?.clear();
    } catch (_) {}
    recaptchaRef.current = null;
    // Destroy and recreate the container div so Firebase can render a
    // fresh reCAPTCHA widget on the next attempt. Without this, Firebase
    // throws "reCAPTCHA has already been rendered in this element".
    const old = document.getElementById("recaptcha-container");
    if (old) {
      const fresh = document.createElement("div");
      fresh.id = "recaptcha-container";
      old.replaceWith(fresh);
    }
  }

  // ── Step 1: send OTP ────────────────────────────────────────────────────────
  async function handleSendOtp() {
    setError("");
    const formatted = formatPhone(dialCode, phone.trim());
    if (!/^\+\d{10,15}$/.test(formatted)) {
      setError("Enter a valid phone number (10 digits).");
      return;
    }

    setLoading(true);
    try {
      clearRecaptcha();
      recaptchaRef.current = createRecaptchaVerifier("recaptcha-container");
      const vid = await sendOtp(formatted, recaptchaRef.current);
      verificationIdRef.current = vid;
      setStep(2);
      startCountdown(30);
    } catch (err) {
      clearRecaptcha();
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  // ── Resend OTP ──────────────────────────────────────────────────────────────
  async function handleResend() {
    setError("");
    setOtp("");
    setLoading(true);
    try {
      clearRecaptcha();
      recaptchaRef.current = createRecaptchaVerifier("recaptcha-container");
      const vid = await sendOtp(
        formatPhone(dialCode, phone.trim()),
        recaptchaRef.current,
      );
      verificationIdRef.current = vid;
      startCountdown(30);
    } catch (err) {
      clearRecaptcha();
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: verify OTP ──────────────────────────────────────────────────────
  async function handleVerifyOtp() {
    setError("");
    if (otp.trim().length < 4) {
      setError("Enter the OTP sent to your phone.");
      return;
    }

    setLoading(true);
    try {
      const { isNewUser, profile } = await verifyOtp(
        verificationIdRef.current,
        otp.trim(),
      );

      if (isNewUser) {
        // No backend profile yet — collect details
        setStep(3);
        return;
      }

      const role = profile?.role?.toUpperCase();
      if (role === "STUDENT") {
        navigate("/no-access", { replace: true });
      } else if (role === "ADMIN" || role === "AUTHOR") {
        navigate(from, { replace: true });
      } else {
        navigate("/no-access", { replace: true });
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: complete signup ─────────────────────────────────────────────────
  async function handleCompleteSignup() {
    setError("");
    if (
      !fullName.trim() ||
      !email.trim() ||
      !collegeName.trim() ||
      !rollNumber.trim()
    ) {
      setError("Please fill in all fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const profile = await completeSignup({
        fullName: fullName.trim(),
        email: email.trim(),
        gender,
        collegeName: collegeName.trim(),
        rollNumber: rollNumber.trim(),
      });

      const role = profile?.role?.toUpperCase();
      if (role === "STUDENT") {
        navigate("/no-access", { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  // ─── render ─────────────────────────────────────────────────────────────────

  const stepTitles = {
    1: "Sign in",
    2: "Verify OTP",
    3: "Complete profile",
  };

  const stepSubtitles = {
    1: "Enter your phone number to continue.",
    2: `OTP sent to ${phone}`,
    3: "One last step — fill in your details.",
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
      {/* Subtle dot-grid background */}
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

      {/* Invisible reCAPTCHA mount point — must stay in DOM */}
      <div id="recaptcha-container" />

      <div style={{ width: "100%", maxWidth: 420, position: "relative" }}>
        {/* Logo / branding */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img
            src={APP_CONFIG.logo}
            alt={`${APP_CONFIG.name} logo`}
            style={{
              width: 60,
              height: 60,
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

        {/* Card */}
        <div
          style={{
            background: "#0f172a",
            border: `1px solid ${T.cardBorder}`,
            borderRadius: 24,
            padding: "32px 36px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
          }}
        >
          <StepIndicator step={step} />

          <h1
            style={{
              margin: "0 0 4px",
              fontSize: 20,
              fontWeight: 800,
              color: T.textPrimary,
              letterSpacing: "-0.02em",
            }}
          >
            {stepTitles[step]}
          </h1>
          <p
            style={{
              margin: "0 0 24px",
              fontSize: 13,
              color: T.textMuted,
            }}
          >
            {stepSubtitles[step]}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* ── Step 1 ── */}
            {step === 1 && (
              <>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: T.textMuted,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    Phone number
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {/* Country / dial code selector */}
                    <select
                      value={dialCode}
                      onChange={(e) => setDialCode(e.target.value)}
                      style={{
                        background: T.cardBg,
                        border: `1px solid ${T.cardBorder}`,
                        borderRadius: 10,
                        color: T.textPrimary,
                        fontSize: 14,
                        padding: "0 10px",
                        height: 44,
                        cursor: "pointer",
                        outline: "none",
                        flexShrink: 0,
                        fontFamily: "inherit",
                      }}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code + c.dial} value={c.dial}>
                          {flag(c.code)} {c.dial}
                        </option>
                      ))}
                    </select>
                    {/* Phone number digits */}
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="98765 43210"
                      autoComplete="tel-national"
                      onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                      style={{
                        flex: 1,
                        background: T.cardBg,
                        border: `1px solid ${T.cardBorder}`,
                        borderRadius: 10,
                        color: T.textPrimary,
                        fontSize: 15,
                        padding: "0 14px",
                        height: 44,
                        outline: "none",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                </div>
                {error && <ErrorBox message={error} />}
                <Button
                  size="lg"
                  fullWidth
                  disabled={loading}
                  onClick={handleSendOtp}
                >
                  {loading ? (
                    <Spinner size={18} color="rgba(0,0,0,0.6)" />
                  ) : (
                    "Send OTP"
                  )}
                </Button>
              </>
            )}

            {/* ── Step 2 ── */}
            {step === 2 && (
              <>
                <Input
                  label="OTP"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  autoComplete="one-time-code"
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                />
                {error && <ErrorBox message={error} />}
                <Button
                  size="lg"
                  fullWidth
                  disabled={loading}
                  onClick={handleVerifyOtp}
                >
                  {loading ? (
                    <Spinner size={18} color="rgba(0,0,0,0.6)" />
                  ) : (
                    "Verify OTP"
                  )}
                </Button>

                {/* Resend / change number */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      clearInterval(countdownRef.current);
                      setStep(1);
                      setOtp("");
                      setError("");
                    }}
                    style={linkStyle}
                  >
                    ← Change number
                  </button>
                  {resendCountdown > 0 ? (
                    <span style={{ fontSize: 12, color: T.textMuted }}>
                      Resend in {resendCountdown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={loading}
                      style={linkStyle}
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
              </>
            )}

            {/* ── Step 3 ── */}
            {step === 3 && (
              <>
                <Input
                  label="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
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
                />
                <Input
                  label="Roll number"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="Your roll number"
                />
                {error && <ErrorBox message={error} />}
                <Button
                  size="lg"
                  fullWidth
                  disabled={loading}
                  onClick={handleCompleteSignup}
                >
                  {loading ? (
                    <Spinner size={18} color="rgba(0,0,0,0.6)" />
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </>
            )}
          </div>
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

// ─── small helpers ────────────────────────────────────────────────────────────

function ErrorBox({ message }) {
  return (
    <div
      style={{
        background: APP_CONFIG.theme.danger.bg,
        color: APP_CONFIG.theme.danger.text,
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {message}
    </div>
  );
}

const linkStyle = {
  background: "none",
  border: "none",
  color: APP_CONFIG.theme.primary,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 500,
  padding: 0,
};
