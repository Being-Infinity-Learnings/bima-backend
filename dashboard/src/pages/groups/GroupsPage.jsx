// Group management page for admins and authors.
//
// Allows creating/editing groups, managing memberships, and deleting groups.
import { useState, useEffect, useCallback } from "react";
import { groupsApi, adminApi } from "../../services/api.service.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  Button,
  Card,
  Input,
  Textarea,
  Avatar,
  Modal,
  EmptyState,
  Spinner,
  toast,
} from "../../components/ui/index.jsx";
import APP_CONFIG from "../../config/app.config.js";

const T = APP_CONFIG.theme;

// Modal used for group creation and editing.
function GroupFormModal({ open, onClose, group, onSaved }) {
  const isEdit = !!group;
  const [name, setName] = useState(group?.name || "");
  const [desc, setDesc] = useState(group?.description || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(group?.name || "");
      setDesc(group?.description || "");
      setError("");
    }
  }, [open, group]);

  // Submit handler for creating or updating a group.
  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (isEdit) {
        await groupsApi.update(group.id, {
          name: name.trim(),
          description: desc.trim() || null,
        });
        toast("Group updated.", "success");
      } else {
        await groupsApi.create({
          name: name.trim(),
          description: desc.trim() || null,
        });
        toast("Group created.", "success");
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(
        err.message ||
          (isEdit ? "Failed to update group" : "Failed to create group"),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Group" : "New Group"}
      width={440}
    >
      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <Input
          label="Group Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. CS Batch A"
          required
        />
        <Textarea
          label="Description (optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Short description..."
          style={{ minHeight: 72 }}
        />
        {error && (
          <div
            style={{
              background: T.danger.bg,
              color: T.danger.text,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Spinner size={14} color="rgba(255,255,255,0.7)" />
            ) : isEdit ? (
              "Save Changes"
            ) : (
              "Create Group"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Modal to show and manage group membership.
function MembersModal({ open, onClose, group, allUsers }) {
  const [members, setMembers] = useState([]);
  const [loadingM, setLoadingM] = useState(false);
  const [search, setSearch] = useState("");
  const [actionId, setActionId] = useState(null);

  // Load the current members of the selected group from the backend.
  const loadMembers = useCallback(async () => {
    if (!group) return;

    setLoadingM(true);
    try {
      const data = await groupsApi.getMembers(group.id);
      setMembers(Array.isArray(data) ? data : []);
    } catch {
      setMembers([]);
    } finally {
      setLoadingM(false);
    }
  }, [group]);

  useEffect(() => {
    if (open) loadMembers();
  }, [open, loadMembers]);

  const memberIds = new Set(
    members.map((member) => member.id || member.userId),
  );
  const query = search.toLowerCase();
  const nonMembers = allUsers.filter(
    (user) =>
      !memberIds.has(user.id) &&
      (user.email?.toLowerCase().includes(query) ||
        user.fullName?.toLowerCase().includes(query)),
  );

  // Add a user to the selected group.
  async function addUser(userId) {
    setActionId(userId);
    try {
      await groupsApi.addUser(group.id, userId);
      toast("User added to group.", "success");
      await loadMembers();
    } catch (err) {
      toast(err.message || "Failed to add user", "error");
    } finally {
      setActionId(null);
    }
  }

  // Remove a user from the selected group.
  async function removeUser(userId) {
    setActionId(userId);
    try {
      await groupsApi.removeUser(group.id, userId);
      toast("User removed from group.", "success");
      await loadMembers();
    } catch (err) {
      toast(err.message || "Failed to remove user", "error");
    } finally {
      setActionId(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Members - ${group?.name}`}
      width={520}
    >
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: T.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 10,
          }}
        >
          Current Members ({members.length})
        </div>
        {loadingM ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 20 }}
          >
            <Spinner size={24} />
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            icon="Group"
            title="No members yet"
            subtitle="Add users from the list below"
          />
        ) : (
          <div
            style={{
              maxHeight: 200,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {members.map((member) => (
              <div
                key={member.id || member.userId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: T.pageBg,
                }}
              >
                <Avatar name={member.fullName || member.email} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: T.textPrimary,
                    }}
                  >
                    {member.fullName || "-"}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>
                    {member.email}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => removeUser(member.id || member.userId)}
                  disabled={!!actionId}
                >
                  {actionId === (member.id || member.userId) ? (
                    <Spinner size={12} />
                  ) : (
                    "Remove"
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${T.cardBorder}`, paddingTop: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: T.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 10,
          }}
        >
          Add Users
        </div>
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        {search && (
          <div
            style={{
              maxHeight: 200,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {nonMembers.length === 0 ? (
              <EmptyState icon="Search" title="No results" />
            ) : (
              nonMembers.map((user) => (
                <div
                  key={user.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: T.pageBg,
                  }}
                >
                  <Avatar name={user.fullName || user.email} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: T.textPrimary,
                      }}
                    >
                      {user.fullName || "-"}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>
                      {user.email}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addUser(user.id)}
                    disabled={!!actionId}
                  >
                    {actionId === user.id ? (
                      <Spinner size={12} color="rgba(255,255,255,0.7)" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// Confirmation modal for deleting a group permanently.
function DeleteModal({ open, onClose, group, onDeleted }) {
  const [loading, setLoading] = useState(false);

  // Send group deletion request and refresh the list on success.
  async function confirm() {
    setLoading(true);
    try {
      await groupsApi.delete(group.id);
      toast("Group deleted.", "success");
      onDeleted();
      onClose();
    } catch (err) {
      toast(err.message || "Failed to delete group", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Delete Group" width={400}>
      <p style={{ color: T.textSecondary, fontSize: 14, marginBottom: 24 }}>
        Are you sure you want to delete <strong>{group?.name}</strong>? This
        action cannot be undone and will remove all group memberships.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={confirm} disabled={loading}>
          {loading ? (
            <Spinner size={14} color={T.danger.text} />
          ) : (
            "Delete Group"
          )}
        </Button>
      </div>
    </Modal>
  );
}

export default function GroupsPage() {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";

  const [groups, setGroups] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formModal, setFormModal] = useState(false);
  const [editGroup, setEditGroup] = useState(null);
  const [membersGroup, setMembersGroup] = useState(null);
  const [deleteGroup, setDeleteGroup] = useState(null);

  // Load all groups and, for admins, all users for membership assignment.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [groupData, userData] = await Promise.all([
        groupsApi.getAll(),
        isAdmin ? adminApi.getAllUsers() : Promise.resolve([]),
      ]);

      setGroups(Array.isArray(groupData) ? groupData : []);
      setAllUsers(Array.isArray(userData) ? userData : []);
    } catch (err) {
      toast("Failed to load groups: " + (err.message || ""), "error");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1000 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 28,
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
            Group Management
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
            Groups
          </h1>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              setEditGroup(null);
              setFormModal(true);
            }}
          >
            + New Group
          </Button>
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Spinner size={36} />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon="Folder"
          title="No groups yet"
          subtitle={
            isAdmin
              ? 'Click "New Group" to create your first student pool.'
              : "No groups exist yet."
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {groups.map((group) => (
            <Card
              key={group.id}
              style={{ padding: 22 }}
              accentColor={T.primary}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: T.primaryLight,
                    color: T.primaryText,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                  }}
                >
                  G
                </div>
                {isAdmin && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditGroup(group);
                        setFormModal(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setDeleteGroup(group)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>

              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: T.textPrimary,
                  marginBottom: 4,
                  letterSpacing: "-0.01em",
                }}
              >
                {group.name}
              </div>
              {group.description && (
                <div
                  style={{
                    fontSize: 12,
                    color: T.textMuted,
                    marginBottom: 12,
                    lineHeight: 1.5,
                  }}
                >
                  {group.description}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <div
                  style={{
                    flex: 1,
                    background: T.pageBg,
                    borderRadius: 10,
                    padding: "8px 12px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: T.primaryText,
                    }}
                  >
                    {group.memberCount ?? group._count?.members ?? "-"}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: T.textMuted,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginTop: 2,
                    }}
                  >
                    Members
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
                    background: T.pageBg,
                    borderRadius: 10,
                    padding: "8px 12px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: T.primaryText,
                    }}
                  >
                    {group.quizCount ?? "-"}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: T.textMuted,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginTop: 2,
                    }}
                  >
                    Quizzes
                  </div>
                </div>
              </div>

              {isAdmin && (
                <Button
                  variant="secondary"
                  fullWidth
                  size="sm"
                  onClick={() => setMembersGroup(group)}
                >
                  Manage Members
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <GroupFormModal
        open={formModal}
        onClose={() => setFormModal(false)}
        group={editGroup}
        onSaved={load}
      />

      {membersGroup && (
        <MembersModal
          open={!!membersGroup}
          onClose={() => setMembersGroup(null)}
          group={membersGroup}
          allUsers={allUsers}
        />
      )}

      {deleteGroup && (
        <DeleteModal
          open={!!deleteGroup}
          onClose={() => setDeleteGroup(null)}
          group={deleteGroup}
          onDeleted={load}
        />
      )}
    </div>
  );
}
