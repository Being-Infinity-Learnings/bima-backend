// Group management page for admins and authors.
//
// Allows creating/editing groups, managing memberships (including bulk file upload), and deleting groups.
import { useState, useEffect, useCallback, useRef } from "react";
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

// ── Group form (create / edit) ────────────────────────────────────────────
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

// ── Members modal with bulk file upload ───────────────────────────────────
function MembersModal({ open, onClose, group, allUsers }) {
  const [members, setMembers] = useState([]);
  const [loadingM, setLoadingM] = useState(false);
  const [search, setSearch] = useState("");
  const [actionId, setActionId] = useState(null);

  // Bulk file upload state
  const [tab, setTab] = useState("members"); // "members" | "search" | "file"
  const [fileText, setFileText] = useState("");
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);

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
    if (open) {
      loadMembers();
      setTab("members");
      setFileText("");
      setUploadResult(null);
      setFileError("");
    }
  }, [open, loadMembers]);

  const memberIds = new Set(members.map((m) => m.id || m.userId));
  const query = search.toLowerCase();
  const nonMembers = allUsers.filter(
    (u) =>
      !memberIds.has(u.id) &&
      (u.email?.toLowerCase().includes(query) ||
        u.fullName?.toLowerCase().includes(query)),
  );

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

  // Parse a file (txt/csv) into an array of trimmed identifiers
  function parseFileContent(text) {
    return text
      .split(/[\n,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFileText(ev.target.result);
      setFileError("");
      setUploadResult(null);
    };
    reader.onerror = () => setFileError("Could not read file.");
    reader.readAsText(file);
  }

  async function submitFileUpload() {
    const identifiers = parseFileContent(fileText);
    if (identifiers.length === 0) {
      setFileError(
        "No identifiers found. Add emails or phone numbers, one per line.",
      );
      return;
    }
    setUploading(true);
    setFileError("");
    setUploadResult(null);
    try {
      const result = await groupsApi.bulkAssignByFile(group.id, identifiers);
      setUploadResult(result);
      toast(`Done — ${result.added} added.`, "success");
      await loadMembers();
    } catch (err) {
      setFileError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const TAB_STYLE = (active) => ({
    padding: "7px 14px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
    border: "1px solid",
    fontFamily: "inherit",
    borderColor: active ? T.primary : T.cardBorder,
    background: active ? T.primaryLight : "transparent",
    color: active ? T.primaryText : T.textMuted,
    transition: "all 0.12s",
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Members — ${group?.name}`}
      width={540}
    >
      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        <button
          style={TAB_STYLE(tab === "members")}
          onClick={() => setTab("members")}
        >
          Current ({members.length})
        </button>
        <button
          style={TAB_STYLE(tab === "search")}
          onClick={() => setTab("search")}
        >
          Add by Search
        </button>
        <button
          style={TAB_STYLE(tab === "file")}
          onClick={() => setTab("file")}
        >
          Bulk Upload
        </button>
      </div>

      {/* ── Current Members tab ── */}
      {tab === "members" && (
        <>
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
              subtitle='Use "Add by Search" or "Bulk Upload" to add users.'
            />
          ) : (
            <div
              style={{
                maxHeight: 360,
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
        </>
      )}

      {/* ── Add by Search tab ── */}
      {tab === "search" && (
        <>
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 10 }}
          />
          <div
            style={{
              maxHeight: 320,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {!search ? (
              <div
                style={{
                  color: T.textMuted,
                  fontSize: 13,
                  textAlign: "center",
                  padding: 20,
                }}
              >
                Type to search users not yet in this group
              </div>
            ) : nonMembers.length === 0 ? (
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
        </>
      )}

      {/* ── Bulk Upload tab ── */}
      {tab === "file" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: T.pageBg,
              border: `1px solid ${T.cardBorder}`,
              fontSize: 12,
              color: T.textMuted,
              lineHeight: 1.7,
            }}
          >
            Upload a <strong style={{ color: T.textSecondary }}>.txt</strong> or{" "}
            <strong style={{ color: T.textSecondary }}>.csv</strong> file
            containing email addresses or phone numbers — one per line, or
            comma/semicolon-separated. Users are matched by their registered
            email or phone.
          </div>

          {/* File picker */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${T.cardBorder}`,
              borderRadius: 12,
              padding: "20px 16px",
              textAlign: "center",
              cursor: "pointer",
              background: T.pageBg,
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = T.primary)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = T.cardBorder)
            }
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>📂</div>
            <div
              style={{ fontSize: 13, color: T.textSecondary, fontWeight: 600 }}
            >
              Click to choose a file
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
              .txt or .csv, plain text identifiers
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />
          </div>

          {/* Preview / edit area */}
          {fileText && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  marginBottom: 6,
                }}
              >
                Preview — edit if needed
              </div>
              <textarea
                value={fileText}
                onChange={(e) => {
                  setFileText(e.target.value);
                  setUploadResult(null);
                  setFileError("");
                }}
                rows={7}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: T.pageBg,
                  border: `1px solid ${T.cardBorder}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                  color: T.textPrimary,
                  fontSize: 12,
                  fontFamily: "monospace",
                  resize: "vertical",
                  outline: "none",
                }}
              />
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
                {parseFileContent(fileText).length} identifier
                {parseFileContent(fileText).length !== 1 ? "s" : ""} detected
              </div>
            </div>
          )}

          {fileError && (
            <div
              style={{
                background: T.danger.bg,
                color: T.danger.text,
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
              }}
            >
              {fileError}
            </div>
          )}

          {uploadResult && (
            <div
              style={{
                background: T.success.bg,
                color: T.success.text,
                borderRadius: 8,
                padding: "12px 14px",
                fontSize: 13,
              }}
            >
              <strong>Upload complete</strong> — {uploadResult.added} added,{" "}
              {uploadResult.skipped} already in group, {uploadResult.notFound}{" "}
              not found.
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              onClick={submitFileUpload}
              disabled={!fileText.trim() || uploading}
            >
              {uploading ? (
                <Spinner size={14} color="rgba(255,255,255,0.7)" />
              ) : (
                "Import Users"
              )}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Delete confirm ────────────────────────────────────────────────────────
function DeleteModal({ open, onClose, group, onDeleted }) {
  const [loading, setLoading] = useState(false);
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

// ── Page ──────────────────────────────────────────────────────────────────
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
