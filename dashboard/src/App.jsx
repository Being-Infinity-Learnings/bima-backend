// Root application component.
//
// Sets up routing, authentication context, protected page access, and global notifications.
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ProtectedRoute, PublicRoute } from "./components/auth/RouteGuard.jsx";
import { ToastContainer } from "./components/ui/index.jsx";
import AppLayout from "./components/layout/AppLayout.jsx";

import LoginPage from "./pages/auth/LoginPage.jsx";
import NoAccessPage from "./pages/auth/NoAccessPage.jsx";
import DashboardPage from "./pages/dashboard/DashboardPage.jsx";
import UsersPage from "./pages/users/UsersPage.jsx";
import GroupsPage from "./pages/groups/GroupsPage.jsx";
import QuizzesPage from "./pages/quizzes/QuizzesPage.jsx";
import { NotificationsPage } from "./pages/placeholder/PlaceholderPages.jsx";
import AnalyticsPage from "./pages/analytics/AnalyticsPage.jsx";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route path="/no-access" element={<NoAccessPage />} />

          {/* Protected admin/author routes */}
          <Route
            element={
              <ProtectedRoute allowedRoles={["ADMIN", "AUTHOR"]}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route
              path="/users"
              element={
                <ProtectedRoute allowedRoles={["ADMIN"]}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/quizzes" element={<QuizzesPage />} />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute allowedRoles={["ADMIN"]}>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer />
    </AuthProvider>
  );
}
