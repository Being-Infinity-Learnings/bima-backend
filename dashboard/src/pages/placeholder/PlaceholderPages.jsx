// Placeholder pages shown for features that are planned but not yet implemented.
//
// These screens provide future context and can be wired to actual APIs later.
import APP_CONFIG from "../../config/app.config.js";
import { Card } from "../../components/ui/index.jsx";

const T = APP_CONFIG.theme;

function ComingSoon({ title, section, description }) {
  return (
    <div style={{ padding: "32px 40px", maxWidth: 800 }}>
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 11,
            color: T.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          {section}
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
          {title}
        </h1>
      </div>
      <Card style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: T.textPrimary,
            margin: "0 0 10px",
          }}
        >
          Coming Soon
        </h2>
        <p
          style={{
            color: T.textSecondary,
            fontSize: 14,
            lineHeight: 1.7,
            maxWidth: 440,
            margin: "0 auto",
          }}
        >
          {description}
        </p>
        <p style={{ color: T.textMuted, fontSize: 12, marginTop: 20 }}>
          This section is ready for development. API hooks and routes are
          already wired up in <code>src/services/api.service.js</code>.
        </p>
      </Card>
    </div>
  );
}

export function QuizzesPage() {
  return (
    <ComingSoon
      title="Quizzes"
      section="Quiz Management"
      description="Create, schedule, and monitor auto-pilot MCQ quiz sessions. Authors and admins can author questions, set per-question timers, and configure visibility (public or group-restricted)."
    />
  );
}


export function AnalyticsPage() {
  return (
    <ComingSoon
      title="Analytics"
      section="Performance & Reporting"
      description="Full leaderboard history, session analytics, attendance-equivalent reporting, and per-quiz participant data — all preserved across sessions."
    />
  );
}

export { default as NotificationsPage } from "../notifications/NotificationsPage.jsx";
