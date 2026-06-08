// Sidebar navigation for the dashboard.
//
// Shows the app logo, menu links filtered by role, and logout controls.
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import APP_CONFIG from "../../config/app.config.js";
import { Avatar } from "../ui/index.jsx";

const T = APP_CONFIG.theme;

const NAV = [
  { to: "/", label: "Dashboard", icon: "⬡", roles: ["ADMIN", "AUTHOR"] },
  { to: "/users", label: "Users", icon: "◉", roles: ["ADMIN"] },
  { to: "/groups", label: "Groups", icon: "⬟", roles: ["ADMIN", "AUTHOR"] },
  { to: "/quizzes", label: "Quizzes", icon: "◈", roles: ["ADMIN", "AUTHOR"] },
  { to: "/notifications", label: "Notifications", icon: "◎", roles: ["ADMIN"] },
  {
    to: "/analytics",
    label: "Analytics",
    icon: "◆",
    roles: ["ADMIN", "AUTHOR"],
  },
];

export default function Sidebar() {
  const { profile, role, logout } = useAuth();
  const navigate = useNavigate();

  const links = NAV.filter((n) => n.roles.includes(role));

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: T.sidebarBg,
        display: "flex",
        flexDirection: "column",
        borderRight: `1px solid ${T.sidebarBorder}`,
        height: "100vh",
        position: "sticky",
        top: 0,
        overflowY: "auto",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "26px 20px 16px",
          borderBottom: `1px solid ${T.sidebarBorder}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src={APP_CONFIG.logo}
            alt={`${APP_CONFIG.name} logo`}
            style={{
              width: 40,
              height: 40,
              flexShrink: 0,
              objectFit: "contain",
              background: "transparent",
            }}
          />
          <div>
            <div
              style={{
                color: "#f1f5f9",
                fontWeight: 800,
                fontSize: 16,
                letterSpacing: "-0.03em",
              }}
            >
              {APP_CONFIG.name}
            </div>
            <div
              style={{
                color: T.sidebarText,
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {APP_CONFIG.tagline}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 10px" }}>
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              background: isActive ? T.sidebarActive : "transparent",
              color: isActive ? T.sidebarActiveText : T.sidebarText,
              fontWeight: isActive ? 700 : 400,
              fontSize: 14,
              textDecoration: "none",
              marginBottom: 2,
              transition: "all 0.1s",
            })}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div
        style={{
          padding: "14px 14px 20px",
          borderTop: `1px solid ${T.sidebarBorder}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <Avatar name={profile?.fullName || profile?.email || "U"} size={32} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: "#e2e8f0",
                fontSize: 12,
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {profile?.fullName || profile?.email || "User"}
            </div>
            <div
              style={{
                color: T.sidebarText,
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {role}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            background: "transparent",
            border: `1px solid ${T.sidebarBorder}`,
            color: T.sidebarText,
            borderRadius: 8,
            padding: "7px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = T.sidebarActive)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
