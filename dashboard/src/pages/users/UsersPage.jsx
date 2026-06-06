// User management page for administrators.
//
// Displays registered users, supports filtering, search, and approve/block actions.
import { useState, useEffect, useCallback } from "react";
import { adminApi } from "../../services/api.service.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  Button,
  Badge,
  Card,
  Input,
  Avatar,
  EmptyState,
  Spinner,
  toast,
} from "../../components/ui/index.jsx";
import APP_CONFIG from "../../config/app.config.js";

const T = APP_CONFIG.theme;

export default function UsersPage() {
  const { role: myRole } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setAction] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getAllUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      toast(
        "Failed to load users: " + (err.message || "Unknown error"),
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Perform approve, block, or unblock actions for a given user.
  async function doAction(id, action) {
    setAction(id + action);
    try {
      if (action === "approve") await adminApi.approveUser(id);
      else if (action === "block") await adminApi.blockUser(id);
      else if (action === "unblock") await adminApi.unblockUser(id);

      toast(`User ${action}d successfully.`, "success");
      await load();
    } catch (err) {
      toast(err.message || `Failed to ${action} user`, "error");
    } finally {
      setAction(null);
    }
  }

  // Compute the display status for each user row.
  function userStatus(user) {
    if (user.blocked) return "BLOCKED";
    if (user.approved) return "APPROVED";
    return "PENDING";
  }

  const STATUS_FILTERS = ["all", "PENDING", "APPROVED", "BLOCKED"];

  const filtered = users.filter((user) => {
    const status = userStatus(user);
    const matchStatus = filter === "all" || status === filter;
    const query = search.toLowerCase();
    const matchSearch =
      !search ||
      user.email?.toLowerCase().includes(query) ||
      user.fullName?.toLowerCase().includes(query) ||
      user.collegeName?.toLowerCase().includes(query);

    return matchStatus && matchSearch;
  });

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 28,
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: T.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            User Management
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
            Users
          </h1>
        </div>
        {myRole === "ADMIN" && (
          <div
            style={{
              fontSize: 12,
              color: T.textMuted,
              maxWidth: 280,
              textAlign: "right",
            }}
          >
            Role changes are not available here because the backend currently
            exposes approval and blocking endpoints only.
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <Input
          placeholder="Search email, name, college..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: "1 1 220px", minWidth: 180 }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {STATUS_FILTERS.map((statusFilter) => (
            <button
              key={statusFilter}
              onClick={() => setFilter(statusFilter)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid",
                borderColor: filter === statusFilter ? T.primary : T.cardBorder,
                background: filter === statusFilter ? T.primaryLight : T.cardBg,
                color:
                  filter === statusFilter ? T.primaryText : T.textSecondary,
                fontSize: 12,
                fontWeight: filter === statusFilter ? 700 : 400,
                cursor: "pointer",
                fontFamily: "inherit",
                textTransform: "capitalize",
              }}
            >
              {statusFilter === "all"
                ? "All"
                : statusFilter.charAt(0) + statusFilter.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 2fr 1.5fr 1fr 1fr 1.5fr",
            padding: "10px 20px",
            background: T.pageBg,
            borderBottom: `1px solid ${T.cardBorder}`,
            borderRadius: "16px 16px 0 0",
          }}
        >
          {["Student", "Email", "College", "Role", "Status", "Actions"].map(
            (header) => (
              <div
                key={header}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: T.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {header}
              </div>
            ),
          )}
        </div>

        {loading ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 48 }}
          >
            <Spinner size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="User"
            title="No users found"
            subtitle="Try adjusting your search or filter"
          />
        ) : (
          filtered.map((user, index) => {
            const status = userStatus(user);
            const busy = (id) => actionLoading === user.id + id;

            return (
              <div
                key={user.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 2fr 1.5fr 1fr 1fr 1.5fr",
                  padding: "14px 20px",
                  alignItems: "center",
                  borderBottom:
                    index < filtered.length - 1
                      ? `1px solid ${T.cardBorder}`
                      : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={user.fullName || user.email} size={34} />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: T.textPrimary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {user.fullName || "-"}
                    </div>
                    <div style={{ fontSize: 10, color: T.textMuted }}>
                      ID: {user.id?.slice(0, 8)}...
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: T.textSecondary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user.email}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: T.textSecondary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user.collegeName || "-"}
                </div>

                <div>
                  <Badge label={user.role || "STUDENT"} />
                </div>
                <div>
                  <Badge label={status} />
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {status === "PENDING" && (
                    <>
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => doAction(user.id, "approve")}
                        disabled={!!actionLoading}
                      >
                        {busy("approve") ? <Spinner size={12} /> : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => doAction(user.id, "block")}
                        disabled={!!actionLoading}
                      >
                        {busy("block") ? <Spinner size={12} /> : "Block"}
                      </Button>
                    </>
                  )}
                  {status === "APPROVED" && (
                    <Button
                      size="sm"
                      variant="warning"
                      onClick={() => doAction(user.id, "block")}
                      disabled={!!actionLoading}
                    >
                      {busy("block") ? <Spinner size={12} /> : "Block"}
                    </Button>
                  )}
                  {status === "BLOCKED" && (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => doAction(user.id, "unblock")}
                      disabled={!!actionLoading}
                    >
                      {busy("unblock") ? <Spinner size={12} /> : "Unblock"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
