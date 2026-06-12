// User management page for administrators.
//
// Displays registered users, supports filtering, search, and approve/block actions.
import { useState, useEffect, useCallback } from "react";
import { adminApi } from "../../services/api.service.js";
import { useAuth } from "../../context/AuthContext.jsx";
import UserDetailModal from "../../components/admin/UserDetailModal.jsx";
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
  const [userGroups, setUserGroups] = useState({}); // { [userId]: [{id, name}] }
  const [loading, setLoading] = useState(true);
  const [actionLoading, setAction] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);

  //Funciton to open user details modal and fetch user data by id. Shows skeleton while loading.
  async function openUserModal(id) {
    setModalLoading(true);
    setSelectedUser({ id }); // open modal immediately with skeleton
    try {
      const [data, groups] = await Promise.all([
        adminApi.getUserById(id),
        adminApi.getUserGroups(id).catch(() => []),
      ]);
      setSelectedUser({ ...data, groups });
    } catch (err) {
      toast(
        "Failed to load user details: " + (err.message || "Unknown error"),
        "error",
      );
      setSelectedUser(null);
    } finally {
      setModalLoading(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getAllUsers();
      const list = Array.isArray(data) ? data : [];
      setUsers(list);

      // Fetch groups for all users in parallel (fire-and-forget per user)
      const entries = await Promise.all(
        list.map((u) =>
          adminApi
            .getUserGroups(u.id)
            .then((g) => [u.id, g])
            .catch(() => [u.id, []]),
        ),
      );
      setUserGroups(Object.fromEntries(entries));
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

  // Handle role changing action for a user.
  async function changeRole(id, newRole) {
    setAction(id + "role");
    try {
      await adminApi.updateUserRole(id, newRole);
      toast(`User role updated to ${newRole} successfully.`, "success");
      await load();
    } catch (err) {
      toast(err.message || "Failed to update role", "error");
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

  function getRoleStyles(role) {
    switch (role) {
      case "ADMIN":
        return {
          background: "#082f49",
          borderColor: "#38bdf8",
          color: "#38bdf8",
        };

      case "AUTHOR":
        return {
          background: "#261f2e",
          borderColor: "#bf97ff",
          color: "#bf97ff",
        };

      default: // STUDENT
        return {
          background: "#1e293b",
          borderColor: "#cbd5e1",
          color: "#cbd5e1",
        };
    }
  }

  function getStatusStyles(status) {
    switch (status) {
      case "APPROVED":
        return {
          background: "rgba(60, 60, 58, 0.9)",
          color: "#a8a8a8",
          dotColor: "#6b6b6b",
        };
      case "PENDING":
        return {
          background: "rgba(58, 54, 49, 0.9)",
          color: "#c2b49a",
          dotColor: "#a08060",
        };
      case "BLOCKED":
      default:
        return {
          background: "rgba(61, 31, 31, 0.9)",
          color: "#d07070",
          dotColor: "#c04040",
        };
    }
  }

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
            Change any user's role instantly using the role selector dropdown
            below.
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
            gridTemplateColumns: "2fr 1.6fr 1.6fr 1.1fr 1.3fr 1.8fr 1.5fr",
            gap: "0 16px",
            padding: "10px 20px",
            background: T.pageBg,
            borderBottom: `1px solid ${T.cardBorder}`,
            borderRadius: "16px 16px 0 0",
          }}
        >
          {["Student", "Email", "College", "Role", "Status", "Groups", "Actions"].map(
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
                  gridTemplateColumns: "2fr 1.6fr 1.6fr 1.1fr 1.3fr 1.8fr 1.5fr",
                  padding: "14px 20px",
                  alignItems: "center",
                  gap: "0 16px",
                  borderBottom:
                    index < filtered.length - 1
                      ? `1px solid ${T.cardBorder}`
                      : "none",
                  background:
                    hoveredRow === user.id
                      ? (T.cardHoverBg ?? "rgba(255,255,255,0.03)")
                      : "transparent",
                  transition: "background 0.15s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                  }}
                  onClick={() => openUserModal(user.id)}
                  onMouseEnter={() => setHoveredRow(user.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
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
                  {myRole === "ADMIN" ? (
                    <select
                      value={user.role || "STUDENT"}
                      onChange={(e) => changeRole(user.id, e.target.value)}
                      disabled={!!actionLoading}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid",
                        background: getRoleStyles(user.role).background,
                        borderColor: getRoleStyles(user.role).borderColor,
                        color: getRoleStyles(user.role).color,
                        fontSize: 12,
                        fontFamily: "inherit",
                        fontWeight: 700,
                        cursor: "pointer",
                        outline: "none",
                      }}
                    >
                      <option value="STUDENT">Student</option>
                      <option value="AUTHOR">Author</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  ) : (
                    <Badge
                      label={user.role || "STUDENT"}
                      style={{
                        background: getRoleStyles(user.role).background,
                        color: getRoleStyles(user.role).color,
                        border: `1px solid ${getRoleStyles(user.role).borderColor}`,
                      }}
                    />
                  )}
                </div>
                <div>
                  <Badge label={status} />
                </div>

                {/* Groups column — show up to 2 tags + overflow count */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                  {(() => {
                    const groups = userGroups[user.id] || [];
                    if (groups.length === 0) {
                      return <span style={{ fontSize: 11, color: T.textMuted }}>—</span>;
                    }
                    const visible = groups.slice(0, 2);
                    const overflow = groups.length - 2;
                    return (
                      <>
                        {visible.map((g) => (
                          <span
                            key={g.id}
                            title={g.name}
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "2px 7px",
                              borderRadius: 6,
                              background: "#1e293b",
                              color: "#94a3b8",
                              border: "1px solid #334155",
                              maxWidth: 80,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              display: "inline-block",
                            }}
                          >
                            {g.name}
                          </span>
                        ))}
                        {overflow > 0 && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: T.textMuted,
                              padding: "2px 5px",
                            }}
                          >
                            +{overflow}
                          </span>
                        )}
                      </>
                    );
                  })()}
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
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          loading={modalLoading}
          onClose={() => setSelectedUser(null)}
          onAction={async (id, action) => {
            await doAction(id, action);
            openUserModal(id);
          }}
        />
      )}
    </div>
  );
}
