// Dashboard landing page for admins and authors.
//
// Shows summary metrics, upcoming items, and quick action links.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { adminApi, groupsApi } from "../../services/api.service.js";
import { Card, Badge, Spinner } from "../../components/ui/index.jsx";
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

const MOCK_UPCOMING = [
  {
    title: "Data Structures - Trees",
    time: "Tonight, 9:00 PM",
    status: "upcoming",
  },
  { title: "OS Fundamentals", time: "Tomorrow, 9:00 PM", status: "upcoming" },
];

export default function DashboardPage() {
  const { profile, role } = useAuth();
  const [metrics, setMetrics] = useState({
    totalUsers: "-",
    pendingUsers: "-",
    groups: "-",
  });
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState("");

  // Load dashboard metrics from the backend depending on the current role.
  // Admins see total and pending users, while authors see group counts only.
  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError("");

    try {
      const groupsPromise = groupsApi.getAll();

      if (role === "ADMIN") {
        const [allUsers, pendingUsers, groups] = await Promise.all([
          adminApi.getAllUsers(),
          adminApi.getPendingUsers(),
          groupsPromise,
        ]);

        setMetrics({
          totalUsers: String(Array.isArray(allUsers) ? allUsers.length : 0),
          pendingUsers: String(
            Array.isArray(pendingUsers) ? pendingUsers.length : 0,
          ),
          groups: String(Array.isArray(groups) ? groups.length : 0),
        });
      } else {
        const groups = await groupsPromise;

        setMetrics({
          totalUsers: "-",
          pendingUsers: "-",
          groups: String(Array.isArray(groups) ? groups.length : 0),
        });
      }
    } catch (err) {
      console.error("Failed to load dashboard metrics", err);
      setMetrics({
        totalUsers: "-",
        pendingUsers: "-",
        groups: "-",
      });
      setMetricsError(err?.message || "Failed to load dashboard metrics.");
    } finally {
      setMetricsLoading(false);
    }
  }, [role]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

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
        <MetricCard value="—" label="Quizzes Scheduled" accent="#ec4899" />
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
          {MOCK_UPCOMING.map((q, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom:
                  i < MOCK_UPCOMING.length - 1
                    ? `1px solid ${T.cardBorder}`
                    : "none",
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
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                  {q.time}
                </div>
              </div>
              <Badge label={q.status} />
            </div>
          ))}
          <p
            style={{
              fontSize: 12,
              color: T.textMuted,
              marginTop: 14,
              fontStyle: "italic",
            }}
          >
            Connect quiz APIs when those backend routes are ready.
          </p>
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
