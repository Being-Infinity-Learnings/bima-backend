// Auth route guards for the dashboard.
//
// Prevents unauthenticated or unauthorized users from accessing protected pages.
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { Spinner } from "../ui/index.jsx";
import APP_CONFIG from "../../config/app.config.js";

// Guard for routes that require an authenticated admin or author user.
export function ProtectedRoute({
  children,
  allowedRoles = ["ADMIN", "AUTHOR"],
}) {
  const { firebaseUser, role, loading, profileLoading } = useAuth();
  const location = useLocation();

  if (loading || (firebaseUser && profileLoading)) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: APP_CONFIG.theme.pageBg,
        }}
      >
        <Spinner size={36} />
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role === "STUDENT") {
    return <Navigate to="/no-access" replace />;
  }

  if (!role) {
    return <Navigate to="/no-access" replace />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/no-access" replace />;
  }

  return children;
}

// Guard for public routes such as login.
// Redirects already authenticated admin/author users back to the dashboard.
export function PublicRoute({ children }) {
  const { firebaseUser, role, loading, profileLoading } = useAuth();

  if (loading || (firebaseUser && profileLoading)) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: APP_CONFIG.theme.pageBg,
        }}
      >
        <Spinner size={36} />
      </div>
    );
  }

  if (firebaseUser && role && role !== "STUDENT") {
    return <Navigate to="/" replace />;
  }

  return children;
}
