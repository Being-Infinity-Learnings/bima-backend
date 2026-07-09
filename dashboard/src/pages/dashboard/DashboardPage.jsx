// Dashboard landing page for admins and authors.
//
// Shows summary metrics, upcoming items, and quick action links.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { adminApi, groupsApi, quizApi } from "../../services/api.service.js";
import { Card, Badge, Spinner } from "../../components/ui/index.jsx";
import { useNavigate } from "react-router-dom";
import APP_CONFIG from "../../config/app.config.js";

const T = APP_CONFIG.theme;

// A small metric card for displaying counts and status values.
function MetricCard({ value, label, accent, loading = false, helper = "" }) {
  return (
    <Card accentColor={accent} style={{ padding: "20px 24px", minHeight: 108 }}>
      {loading ? (
        <div style={{ minHeight: 28, display: "flex", alignItems: "center" }}>
          <Spinner size={22} />
        </div>
      ) : (
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: T.textPrimary,
            lineHeight: 1,
          }}
        >
          {value}
        </div>
      )}
      <div
        style={{
          fontSize: 12,
          color: T.textMuted,
          marginTop: 8,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      {helper ? (
        <div
          style={{
            fontSize: 11,
            color: T.textMuted,
            marginTop: 8,
            lineHeight: 1.4,
          }}
        >
          {helper}
        </div>
      ) : null}
    </Card>
  );
}



export default function DashboardPage() {
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    totalUsers: "-",
    pendingUsers: "-",
    groups: "-",
    scheduledQuizzes: "-",
    completedQuizzes: "-",
  });
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState("");

  const [upcomingQuizzes, setUpcomingQuizzes] = useState([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [upcomingError, setUpcomingError] = useState("");

  // Load dashboard metrics from the backend depending on the current role.
  // Admins see total and pending users, while authors see group counts only.
  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError("");

    try {
      const groupsPromise = groupsApi.getAll();
      const allQuizzesPromise = quizApi.getAll();

      if (role === "ADMIN") {
        const [allUsers, pendingUsers, groups, allQuizzes] = await Promise.all([
          adminApi.getAllUsers(),
          adminApi.getPendingUsers(),
          groupsPromise,
          allQuizzesPromise,
        ]);

        const scheduledQuizzes = allQuizzes.filter(
          (q) => q.status === "SCHEDULED",
        );
        const completedQuizzes = allQuizzes.filter(
          (q) => q.status === "COMPLETED",
        );

        setMetrics({
          totalUsers: String(Array.isArray(allUsers) ? allUsers.length : 0),
          pendingUsers: String(
            Array.isArray(pendingUsers) ? pendingUsers.length : 0,
          ),
          groups: String(Array.isArray(groups) ? groups.length : 0),
          scheduledQuizzes: String(scheduledQuizzes.length),
          completedQuizzes: String(completedQuizzes.length),
        });
      } else {
        const [groups, allQuizzes] = await Promise.all([
          groupsPromise,
          allQuizzesPromise,
        ]);

        const scheduledQuizzes = allQuizzes.filter(
          (q) => q.status === "SCHEDULED",
        );
        const completedQuizzes = allQuizzes.filter(
          (q) => q.status === "COMPLETED",
        );

        setMetrics({
          totalUsers: "-",
          pendingUsers: "-",
          groups: String(Array.isArray(groups) ? groups.length : 0),
          scheduledQuizzes: String(scheduledQuizzes.length),
          completedQuizzes: String(completedQuizzes.length),
        });
      }
    } catch (err) {
      console.error("Failed to load dashboard metrics", err);
      setMetrics({
        totalUsers: "-",
        pendingUsers: "-",
        groups: "-",
        scheduledQuizzes: "-",
        completedQuizzes: "-",
      });
      setMetricsError(err?.message || "Failed to load dashboard metrics.");
    } finally {
      setMetricsLoading(false);
    }
  }, [role]);

  const loadUpcomingQuizzes = useCallback(async () => {
    setUpcomingLoading(true);
    setUpcomingError("");

    try {
      const allQuizzes = await quizApi.getAll();
      const upcoming = allQuizzes.filter((q) => q.status === "SCHEDULED");

      // Sort by scheduled start time, earliest first
      upcoming.sort((a, b) => {
        return (
          new Date(a.scheduledStartTime).getTime() -
          new Date(b.scheduledStartTime).getTime()
        );
      });

      setUpcomingQuizzes(upcoming.slice(0, 2)); // Show top 2 upcoming
    } catch (err) {
      console.error("Failed to load upcoming quizzes", err);
      setUpcomingError(err?.message || "Failed to load upcoming quizzes.");
    } finally {
      setUpcomingLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
    loadUpcomingQuizzes();
  }, [loadMetrics, loadUpcomingQuizzes]);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100 }}>
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontSize: 11,
            color: T.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 4,
          }}
        >
          {APP_CONFIG.org} · {APP_CONFIG.name}
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: T.textPrimary,
            margin: "0 0 6px",
            letterSpacing: "-0.03em",
          }}
        >
          {greeting}
        </h1>
        <p style={{ color: T.textSecondary, margin: 0, fontSize: 14 }}>
          Signed in as <strong>{profile?.email}</strong> &nbsp;·&nbsp;{" "}
          <Badge label={role} />
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <MetricCard
          value={metrics.totalUsers}
          label="Total Users"
          accent={T.primary}
          loading={metricsLoading}
          helper={role === "ADMIN" ? "" : "Visible to admins only."}
        />
        <MetricCard
          value={metrics.pendingUsers}
          label="Pending Approvals"
          accent={T.warning?.dot || "#f59e0b"}
          loading={metricsLoading}
          helper={role === "ADMIN" ? "" : "Visible to admins only."}
        />
        <MetricCard
          value={metrics.groups}
          label="Active Groups"
          accent="#0d9488"
          loading={metricsLoading}
        />
        <MetricCard
          value={metrics.scheduledQuizzes}
          label="Quizzes Scheduled"
          accent="#ec4899"
          loading={metricsLoading}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card style={{ padding: 24 }}>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: T.textPrimary,
              margin: "0 0 16px",
              letterSpacing: "-0.01em",
            }}
          >
            Upcoming Quizzes
          </h2>
          {upcomingLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 20 }}>
              <Spinner size={26} />
            </div>
          ) : upcomingError ? (
            <p style={{ color: T.danger?.text, fontSize: 13 }}>
              {upcomingError}
            </p>
          ) : upcomingQuizzes.length === 0 ? (
            <p style={{ color: T.textMuted, fontSize: 13 }}>
              No upcoming quizzes.
            </p>
          ) : (
            upcomingQuizzes.map((q, i) => (
              <a
                key={i}
                onClick={() => navigate(`/quizzes?quizId=${q._id}`)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom:
                    i < upcomingQuizzes.length - 1
                      ? `1px solid ${T.cardBorder}`
                      : "none",
                  textDecoration: "none",
                  cursor: "pointer",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: T.textPrimary,
                    }}
                  >
                    {q.title}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: T.textMuted,
                      marginTop: 2,
                    }}
                  >
                    {new Date(q.scheduledStartTime).toLocaleString()}
                  </div>
                </div>
                <Badge label={q.status} />
              </a>
            ))
          )}
        </Card>

        <Card style={{ padding: 24 }}>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: T.textPrimary,
              margin: "0 0 16px",
              letterSpacing: "-0.01em",
            }}
          >
            Quick Actions
          </h2>
          {[
            {
              label: "Review pending users",
              href: "/users",
              icon: "User",
              note: "Approve or block registrations",
            },
            {
              label: "Manage groups",
              href: "/groups",
              icon: "Group",
              note: "Create and edit student pools",
            },
            {
              label: "Create a quiz",
              href: "/quizzes",
              icon: "Quiz",
              note: "Author and schedule a new quiz",
            },
          ]
            .filter((a) => role === "ADMIN" || a.href !== "/users")
            .map((a, i, arr) => (
              <a
                key={i}
                href={a.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  textDecoration: "none",
                  borderBottom:
                    i < arr.length - 1 ? `1px solid ${T.cardBorder}` : "none",
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: T.textMuted,
                    minWidth: 40,
                  }}
                >
                  {a.icon}
                </span>
                <div>
                  <div
                    style={{ fontSize: 13, fontWeight: 700, color: T.primary }}
                  >
                    {a.label}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>
                    {a.note}
                  </div>
                </div>
              </a>
            ))}
        </Card>
      </div>
    </div>
  );
}
