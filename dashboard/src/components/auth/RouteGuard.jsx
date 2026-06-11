// Auth route guards for the dashboard.
//
// Prevents unauthenticated or unauthorized users from accessing protected pages.
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { Spinner } from "../ui/index.jsx";
import APP_CONFIG from "../../config/app.config.js";

const T = APP_CONFIG.theme;

const spinnerPage = (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      background: T.pageBg,
    }}
  >
    <Spinner size={36} />
  </div>
);

// Guard for routes that require an authenticated admin or author user.
export function ProtectedRoute({
  children,
  allowedRoles = ["ADMIN", "AUTHOR"],
}) {
  const { firebaseUser, role, loading, profileLoading } = useAuth();
  const location = useLocation();

  if (loading || profileLoading) return spinnerPage;
  if (!firebaseUser)
    return <Navigate to="/login" state={{ from: location }} replace />;
  if (role === "STUDENT") return <Navigate to="/no-access" replace />;
  if (!role) return <Navigate to="/no-access" replace />;
  if (!allowedRoles.includes(role)) return <Navigate to="/no-access" replace />;

  return children;
}

// Guard for public routes such as login.
//
// Key behaviour: children are ALWAYS rendered so that LoginPage is never
// unmounted mid-flow (e.g. during OTP verification when profileLoading
// flickers true→false and would otherwise swap the spinner element for
// LoginPage, causing React to remount it and reset all useState).
// Instead we render children unconditionally and overlay a blocker on top
// while async work is in flight.
export function PublicRoute({ children }) {
  const { firebaseUser, role, loading, profileLoading } = useAuth();

  // Fully resolved non-student session → redirect away from login.
  if (
    !loading &&
    !profileLoading &&
    firebaseUser &&
    role &&
    role !== "STUDENT"
  ) {
    return <Navigate to="/" replace />;
  }

  // Render children always — never swap them out for a spinner element,
  // which would unmount and remount LoginPage and reset its state.
  // Instead, overlay a transparent blocker during initial load only.
  return (
    <div style={{ position: "relative" }}>
      {children}
      {(loading || profileLoading) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: T.pageBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <Spinner size={36} />
        </div>
      )}
    </div>
  );
}
