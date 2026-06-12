// User management page for administrators.
//
// Supports filtering, search, approve/block actions, multi-select bulk operations,
// and assigning selected users to a group in one shot.
import { useState, useEffect, useCallback } from "react";
import { adminApi, groupsApi } from "../../services/api.service.js";
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

// ── Assign-to-group modal ─────────────────────────────────────────────────
function AssignGroupModal({ open, onClose, selectedIds, onDone }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setChosen(null);
    setSearch("");
    setLoading(true);
    groupsApi
      .getAll()
      .then((d) => setGroups(Array.isArray(d) ? d : []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()),
  );

  async function assign() {
    if (!chosen) return;
    setSubmitting(true);
    try {
      const result = await groupsApi.bulkAssignUsers(chosen, selectedIds);
      toast(
        `Done — ${result.added} added, ${result.skipped} already in group.`,
        "success",
      );
      onDone();
      onClose();
    } catch (err) {
      toast(err.message || "Failed to assign users", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.cardBg,
          border: `1px solid ${T.cardBorder}`,
          borderRadius: 20,
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          padding: 24,
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: T.textPrimary,
            marginBottom: 4,
          }}
        >
          Assign to Group
        </div>
        <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>
          Adding{" "}
          <strong style={{ color: T.textPrimary }}>{selectedIds.length}</strong>{" "}
          selected user{selectedIds.length !== 1 ? "s" : ""} to a group.
        </div>

        <Input
          placeholder="Search groups..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 12 }}
        />

        {loading ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 24 }}
          >
            <Spinner size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              color: T.textMuted,
              fontSize: 13,
              textAlign: "center",
              padding: 16,
            }}
          >
            No groups found
          </div>
        ) : (
          <div
            style={{
              maxHeight: 260,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginBottom: 20,
            }}
          >
            {filtered.map((g) => (
              <div
                key={g.id}
                onClick={() => setChosen(g.id)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  cursor: "pointer",
                  border: `1px solid ${chosen === g.id ? T.primary : T.cardBorder}`,
                  background: chosen === g.id ? T.primaryLight : T.pageBg,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  transition: "all 0.12s",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: chosen === g.id ? T.primary : T.cardBorder,
                    transition: "background 0.12s",
                  }}
                />
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: T.textPrimary,
                    }}
                  >
                    {g.name}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>
                    {g._count?.members ?? g.memberCount ?? 0} members
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={assign} disabled={!chosen || submitting}>
            {submitting ? (
              <Spinner size={14} color="rgba(255,255,255,0.7)" />
            ) : (
              "Assign"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { role: myRole } = useAuth();
  const [users, setUsers] = useState([]);
  const [userGroups, setUserGroups] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setAction] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);

  // Multi-select
  const [selected, setSelected] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  async function openUserModal(id) {
    setModalLoading(true);
    setSelectedUser({ id });
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
      setSelected(new Set()); // clear selection on reload

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

  // Bulk approve all selected pending users
  async function bulkApprove() {
    const pendingIds = [...selected].filter((id) => {
      const u = users.find((u) => u.id === id);
      return u && !u.approved && !u.blocked;
    });
    if (pendingIds.length === 0) {
      toast("No pending users in selection.", "warning");
      return;
    }
    setBulkBusy(true);
    try {
      const result = await adminApi.bulkApproveUsers(pendingIds);
      toast(
        `${result.approved} user${result.approved !== 1 ? "s" : ""} approved.`,
        "success",
      );
      await load();
    } catch (err) {
      toast(err.message || "Bulk approve failed", "error");
    } finally {
      setBulkBusy(false);
    }
  }

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

  // Select-all logic scoped to currently visible filtered list
  const filteredIds = filtered.map((u) => u.id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

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
      default:
        return {
          background: "#1e293b",
          borderColor: "#cbd5e1",
          color: "#cbd5e1",
        };
    }
  }

  const GRID = "32px 1.8fr 1.5fr 1.5fr 1.1fr 1.2fr 1.7fr 1.4fr";

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1200 }}>
      {/* Page header */}
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
            Change any user's role using the dropdown. Multi-select for bulk
            actions.
          </div>
        )}
      </div>

      {/* Filters + search */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 12,
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
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf}
              onClick={() => setFilter(sf)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid",
                borderColor: filter === sf ? T.primary : T.cardBorder,
                background: filter === sf ? T.primaryLight : T.cardBg,
                color: filter === sf ? T.primaryText : T.textSecondary,
                fontSize: 12,
                fontWeight: filter === sf ? 700 : 400,
                cursor: "pointer",
                fontFamily: "inherit",
                textTransform: "capitalize",
              }}
            >
              {sf === "all" ? "All" : sf.charAt(0) + sf.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk-action toolbar — slides in when something is selected */}
      {someSelected && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            marginBottom: 12,
            background: T.primaryLight,
            border: `1px solid ${T.primary}40`,
            borderRadius: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: T.primaryText }}>
            {selected.size} selected
          </span>
          <div style={{ width: 1, height: 18, background: `${T.primary}40` }} />
          <Button
            size="sm"
            variant="success"
            disabled={bulkBusy}
            onClick={bulkApprove}
          >
            {bulkBusy ? <Spinner size={12} /> : `Approve Selected`}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={bulkBusy}
            onClick={() => setAssignOpen(true)}
          >
            Assign to Group
          </Button>
          <button
            onClick={() => setSelected(new Set())}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: T.textMuted,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Clear
          </button>
        </div>
      )}

      <Card>
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: GRID,
            gap: "0 16px",
            padding: "10px 20px",
            background: T.pageBg,
            borderBottom: `1px solid ${T.cardBorder}`,
            borderRadius: "16px 16px 0 0",
            alignItems: "center",
          }}
        >
          {/* Select-all checkbox */}
          <div>
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAll}
              style={{
                accentColor: T.primary,
                cursor: "pointer",
                width: 15,
                height: 15,
              }}
            />
          </div>
          {[
            "Student",
            "Email",
            "College",
            "Role",
            "Status",
            "Groups",
            "Actions",
          ].map((h) => (
            <div
              key={h}
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: T.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {h}
            </div>
          ))}
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
            const busy = (key) => actionLoading === user.id + key;
            const isChecked = selected.has(user.id);

            return (
              <div
                key={user.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID,
                  padding: "13px 20px",
                  alignItems: "center",
                  gap: "0 16px",
                  borderBottom:
                    index < filtered.length - 1
                      ? `1px solid ${T.cardBorder}`
                      : "none",
                  background: isChecked
                    ? "rgba(181,232,44,0.04)"
                    : hoveredRow === user.id
                      ? (T.cardHoverBg ?? "rgba(255,255,255,0.03)")
                      : "transparent",
                  transition: "background 0.15s",
                }}
              >
                {/* Checkbox */}
                <div onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOne(user.id)}
                    style={{
                      accentColor: T.primary,
                      cursor: "pointer",
                      width: 15,
                      height: 15,
                    }}
                  />
                </div>

                {/* Name + avatar — click opens modal */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    minWidth: 0,
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

                {/* Email */}
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

                {/* College */}
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

                {/* Role */}
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

                {/* Status */}
                <div>
                  <Badge label={status} />
                </div>

                {/* Groups */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                    alignItems: "center",
                  }}
                >
                  {(() => {
                    const groups = userGroups[user.id] || [];
                    if (groups.length === 0)
                      return (
                        <span style={{ fontSize: 11, color: T.textMuted }}>
                          —
                        </span>
                      );
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

                {/* Actions */}
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
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

      <AssignGroupModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        selectedIds={[...selected]}
        onDone={load}
      />
    </div>
  );
}
