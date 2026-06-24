// Quiz management page for admins and authors.
//
// Three-panel workflow: Quiz list → Quiz detail (questions in quiz) → Question bank.
// Supports full CRUD on quizzes and questions, adding/removing questions from quizzes,
// publish/unpublish control, and group assignment for restricted quizzes.

import { useState, useEffect, useCallback } from "react";
import {
  quizApi,
  questionApi,
  quizCompositionApi,
  groupsApi,
} from "../../services/api.service.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  Button,
  Card,
  Input,
  Textarea,
  Select,
  Modal,
  EmptyState,
  Spinner,
  Badge,
  toast,
} from "../../components/ui/index.jsx";
import APP_CONFIG from "../../config/app.config.js";

const T = APP_CONFIG.theme;

// ── Helpers ──────────────────────────────────────────────────────────────────

const QUESTION_TYPES = [
  { value: "SINGLE_CORRECT", label: "Single correct" },
  { value: "MULTI_CORRECT", label: "Multiple correct" },
  { value: "TEXT", label: "Text answer" },
  { value: "NUMERIC", label: "Numeric answer" },
];

const VISIBILITY_OPTIONS = [
  { value: "PUBLIC", label: "Public — visible to all" },
  { value: "RESTRICTED", label: "Restricted — assigned groups only" },
];

function typeLabel(t) {
  return QUESTION_TYPES.find((x) => x.value === t)?.label ?? t;
}

function QuizStatusBadge({ quiz }) {
  if (quiz.isPublished)
    return <Badge label="published" customColors={T.success} />;
  return <Badge label="draft" customColors={T.neutral} />;
}

function VisibilityBadge({ visibility }) {
  if (visibility === "RESTRICTED")
    return <Badge label="restricted" customColors={T.warning} />;
  return <Badge label="public" customColors={T.info} />;
}

// ── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, action }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 20,
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: T.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 2,
          }}
        >
          {subtitle}
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 800,
            color: T.textPrimary,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

// ── Quiz Form Modal ────────────────────────────────────────────────────────

function QuizFormModal({ open, onClose, quiz, onSaved }) {
  const isEdit = !!quiz;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [defaultTimer, setDefaultTimer] = useState("30");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(quiz?.title ?? "");
      setDescription(quiz?.description ?? "");
      setVisibility(quiz?.visibility ?? "PUBLIC");
      setDefaultTimer(String(quiz?.defaultTimer ?? 30));
      setError("");
    }
  }, [open, quiz]);

  async function submit() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const timer = parseInt(defaultTimer, 10);
    if (!timer || timer < 5) {
      setError("Default timer must be at least 5 seconds.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        visibility,
        defaultTimer: timer,
      };
      if (isEdit) {
        await quizApi.update(quiz.id, body);
        toast("Quiz updated.", "success");
      } else {
        await quizApi.create(body);
        toast("Quiz created.", "success");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save quiz.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit quiz" : "New quiz"}
      width={520}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Biology Chapter 3"
        />
        <Textarea
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this quiz…"
          rows={3}
        />
        <Select
          label="Visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          options={VISIBILITY_OPTIONS}
        />
        <Input
          label="Default timer per question (seconds)"
          type="number"
          min={5}
          value={defaultTimer}
          onChange={(e) => setDefaultTimer(e.target.value)}
        />
        {error && (
          <p style={{ color: T.danger.text, fontSize: 13, margin: 0 }}>
            {error}
          </p>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? (
              <Spinner size={16} color="#fff" />
            ) : isEdit ? (
              "Save changes"
            ) : (
              "Create quiz"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Question Form Modal ────────────────────────────────────────────────────

function defaultOptions() {
  return [
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
  ];
}

function QuestionFormModal({ open, onClose, question, onSaved }) {
  const isEdit = !!question;
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState("SINGLE_CORRECT");
  const [timerSeconds, setTimerSeconds] = useState("30");
  const [options, setOptions] = useState(defaultOptions());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setQuestionText(question?.questionText ?? "");
      setQuestionType(question?.questionType ?? "SINGLE_CORRECT");
      setTimerSeconds(String(question?.timerSeconds ?? 30));
      setOptions(
        question?.options?.length
          ? question.options.map((o) => ({
              optionText: o.optionText,
              isCorrect: o.isCorrect,
            }))
          : defaultOptions(),
      );
      setError("");
    }
  }, [open, question]);

  const isTextBased = questionType === "TEXT" || questionType === "NUMERIC";

  function setOption(idx, field, value) {
    setOptions((prev) => {
      const next = [...prev];
      if (field === "isCorrect" && questionType === "SINGLE_CORRECT") {
        next.forEach((o, i) => {
          next[i] = { ...o, isCorrect: i === idx };
        });
      } else {
        next[idx] = { ...next[idx], [field]: value };
      }
      return next;
    });
  }

  function addOption() {
    setOptions((prev) => [...prev, { optionText: "", isCorrect: false }]);
  }

  function removeOption(idx) {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (!questionText.trim()) {
      setError("Question text is required.");
      return;
    }
    const timer = parseInt(timerSeconds, 10);
    if (!timer || timer < 5) {
      setError("Timer must be at least 5 seconds.");
      return;
    }
    if (!isTextBased) {
      if (options.length < 2) {
        setError("At least 2 options are required.");
        return;
      }
      if (options.some((o) => !o.optionText.trim())) {
        setError("All options must have text.");
        return;
      }
      if (!options.some((o) => o.isCorrect)) {
        setError("Mark at least one correct answer.");
        return;
      }
    }
    setLoading(true);
    setError("");
    try {
      const body = {
        questionText: questionText.trim(),
        questionType,
        timerSeconds: timer,
        options: isTextBased
          ? []
          : options.map((o) => ({
              optionText: o.optionText.trim(),
              isCorrect: o.isCorrect,
            })),
      };
      if (isEdit) {
        await questionApi.update(question.id, body);
        toast("Question updated.", "success");
      } else {
        await questionApi.create(body);
        toast("Question created.", "success");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save question.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit question" : "New question"}
      width={600}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Textarea
          label="Question text"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder="Enter the question…"
          rows={3}
        />
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Select
              label="Question type"
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
              options={QUESTION_TYPES}
            />
          </div>
          <div style={{ width: 160 }}>
            <Input
              label="Timer (seconds)"
              type="number"
              min={5}
              value={timerSeconds}
              onChange={(e) => setTimerSeconds(e.target.value)}
            />
          </div>
        </div>

        {!isTextBased && (
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: T.textSecondary,
                marginBottom: 8,
              }}
            >
              Answer options{" "}
              <span style={{ color: T.textMuted, fontWeight: 400 }}>
                — tick the correct one
                {questionType === "MULTI_CORRECT" ? "s" : ""}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {options.map((opt, idx) => (
                <div
                  key={idx}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <input
                    type={
                      questionType === "MULTI_CORRECT" ? "checkbox" : "radio"
                    }
                    checked={opt.isCorrect}
                    onChange={(e) =>
                      setOption(idx, "isCorrect", e.target.checked)
                    }
                    style={{
                      accentColor: T.primary,
                      width: 16,
                      height: 16,
                      flexShrink: 0,
                      cursor: "pointer",
                    }}
                  />
                  <input
                    value={opt.optionText}
                    onChange={(e) =>
                      setOption(idx, "optionText", e.target.value)
                    }
                    placeholder={`Option ${idx + 1}`}
                    style={{
                      flex: 1,
                      background: T.pageBg,
                      border: `1px solid ${T.cardBorder}`,
                      borderRadius: 8,
                      padding: "8px 12px",
                      color: T.textPrimary,
                      fontSize: 13,
                      outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(idx)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: T.danger.dot,
                        cursor: "pointer",
                        fontSize: 16,
                        padding: "0 4px",
                        lineHeight: 1,
                      }}
                      title="Remove option"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addOption}
              style={{
                marginTop: 10,
                background: "transparent",
                border: `1px dashed ${T.cardBorder}`,
                borderRadius: 8,
                color: T.textMuted,
                fontSize: 12,
                padding: "6px 14px",
                cursor: "pointer",
                width: "100%",
                fontFamily: "inherit",
              }}
            >
              + Add option
            </button>
          </div>
        )}

        {error && (
          <p style={{ color: T.danger.text, fontSize: 13, margin: 0 }}>
            {error}
          </p>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? (
              <Spinner size={16} color="#fff" />
            ) : isEdit ? (
              "Save changes"
            ) : (
              "Create question"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Group Assignment Modal ─────────────────────────────────────────────────

function GroupAssignModal({ open, onClose, quiz, onSaved }) {
  const [allGroups, setAllGroups] = useState([]);
  const [assignedIds, setAssignedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !quiz) return;
    setLoading(true);
    setError("");
    Promise.all([groupsApi.getAll(), quizApi.getGroups(quiz.id)])
      .then(([groups, assigned]) => {
        setAllGroups(groups ?? []);
        setAssignedIds(
          new Set((assigned ?? []).map((a) => a.groupId ?? a.group?.id)),
        );
      })
      .catch((err) => setError(err.message || "Failed to load groups."))
      .finally(() => setLoading(false));
  }, [open, quiz]);

  async function toggle(groupId) {
    const isAssigned = assignedIds.has(groupId);
    setSaving(true);
    setError("");
    try {
      if (isAssigned) {
        await quizApi.removeGroup(quiz.id, groupId);
        setAssignedIds((prev) => {
          const next = new Set(prev);
          next.delete(groupId);
          return next;
        });
        toast("Group removed.", "success");
      } else {
        await quizApi.addGroups(quiz.id, [groupId]);
        setAssignedIds((prev) => new Set([...prev, groupId]));
        toast("Group assigned.", "success");
      }
      onSaved?.();
    } catch (err) {
      setError(err.message || "Action failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Assign groups" width={480}>
      {loading ? (
        <div style={{ textAlign: "center", padding: 32 }}>
          <Spinner />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 13, color: T.textMuted, margin: "0 0 8px" }}>
            Toggle groups that can access this quiz. Changes save immediately.
          </p>
          {allGroups.length === 0 && (
            <p style={{ color: T.textMuted, fontSize: 13 }}>
              No groups exist yet. Create groups first.
            </p>
          )}
          {allGroups.map((g) => {
            const assigned = assignedIds.has(g.id);
            return (
              <div
                key={g.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: assigned ? `${T.primary}15` : T.pageBg,
                  border: `1px solid ${assigned ? T.primary + "40" : T.cardBorder}`,
                  transition: "all 0.15s",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: T.textPrimary,
                    }}
                  >
                    {g.name}
                  </div>
                  {g.description && (
                    <div style={{ fontSize: 11, color: T.textMuted }}>
                      {g.description}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={assigned ? "danger" : "secondary"}
                  onClick={() => toggle(g.id)}
                  disabled={saving}
                >
                  {assigned ? "Remove" : "Add"}
                </Button>
              </div>
            );
          })}
          {error && (
            <p style={{ color: T.danger.text, fontSize: 13, margin: 0 }}>
              {error}
            </p>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 8,
            }}
          >
            <Button variant="ghost" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Add Questions Modal (pick from bank) ───────────────────────────────────

function AddQuestionsModal({ open, onClose, quiz, alreadyInQuiz, onSaved }) {
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected(new Set());
    setSearch("");
    setError("");
    questionApi
      .getAll()
      .then((q) => setQuestions(q ?? []))
      .catch((err) => setError(err.message || "Failed to load questions."))
      .finally(() => setLoading(false));
  }, [open]);

  const alreadyIds = new Set(
    (alreadyInQuiz ?? []).map((q) => q.questionId ?? q.question?.id),
  );

  const filtered = questions.filter(
    (q) =>
      !alreadyIds.has(q.id) &&
      q.questionText.toLowerCase().includes(search.toLowerCase()),
  );

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addSelected() {
    if (selected.size === 0) return;
    setSaving(true);
    setError("");
    try {
      await quizCompositionApi.addQuestions(quiz.id, [...selected]);
      toast(
        `${selected.size} question${selected.size > 1 ? "s" : ""} added.`,
        "success",
      );
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to add questions.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add questions from bank"
      width={620}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Input
          placeholder="Search questions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {loading ? (
          <div style={{ textAlign: "center", padding: 24 }}>
            <Spinner />
          </div>
        ) : (
          <div
            style={{
              maxHeight: 380,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {filtered.length === 0 && (
              <p
                style={{
                  color: T.textMuted,
                  fontSize: 13,
                  textAlign: "center",
                  padding: 24,
                }}
              >
                {questions.length === 0
                  ? "No questions in bank yet."
                  : "All questions already added, or no matches."}
              </p>
            )}
            {filtered.map((q) => {
              const sel = selected.has(q.id);
              return (
                <div
                  key={q.id}
                  onClick={() => toggleSelect(q.id)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: sel ? `${T.primary}15` : T.pageBg,
                    border: `1px solid ${sel ? T.primary + "50" : T.cardBorder}`,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      border: `2px solid ${sel ? T.primary : T.cardBorder}`,
                      background: sel ? T.primary : "transparent",
                      flexShrink: 0,
                      marginTop: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#000",
                      fontSize: 11,
                      fontWeight: 800,
                      transition: "all 0.15s",
                    }}
                  >
                    {sel && "✓"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: T.textPrimary,
                        lineHeight: 1.5,
                        marginBottom: 4,
                      }}
                    >
                      {q.questionText}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Badge
                        label={typeLabel(q.questionType)}
                        customColors={T.neutral}
                      />
                      <span style={{ fontSize: 11, color: T.textMuted }}>
                        ⏱ {q.timerSeconds}s
                      </span>
                      {q.options?.length > 0 && (
                        <span style={{ fontSize: 11, color: T.textMuted }}>
                          {q.options.length} options
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {error && (
          <p style={{ color: T.danger.text, fontSize: 13, margin: 0 }}>
            {error}
          </p>
        )}
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 12, color: T.textMuted }}>
            {selected.size > 0
              ? `${selected.size} selected`
              : "Select questions to add"}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={addSelected}
              disabled={saving || selected.size === 0}
            >
              {saving ? (
                <Spinner size={16} color="#fff" />
              ) : (
                `Add ${selected.size || ""} question${selected.size !== 1 ? "s" : ""}`
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Quiz Detail Panel ──────────────────────────────────────────────────────

function QuizDetailPanel({ quiz, onBack, onQuizUpdated, role }) {
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showAddQs, setShowAddQs] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showEditQuiz, setShowEditQuiz] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchQuizQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    try {
      const data = await quizCompositionApi.getQuestions(quiz.id);
      setQuizQuestions(data ?? []);
    } catch (err) {
      setError(err.message || "Failed to load questions.");
    } finally {
      setLoadingQuestions(false);
    }
  }, [quiz.id]);

  useEffect(() => {
    fetchQuizQuestions();
  }, [fetchQuizQuestions]);

  async function removeQuestion(questionId) {
    try {
      await quizCompositionApi.removeQuestion(quiz.id, questionId);
      toast("Question removed.", "success");
      fetchQuizQuestions();
    } catch (err) {
      toast(err.message || "Failed to remove question.", "error");
    }
  }

  async function togglePublish() {
    setPublishLoading(true);
    try {
      if (quiz.isPublished) {
        await quizApi.unpublish(quiz.id);
        toast("Quiz unpublished.", "success");
      } else {
        await quizApi.publish(quiz.id);
        toast("Quiz published!", "success");
      }
      onQuizUpdated();
    } catch (err) {
      toast(err.message || "Action failed.", "error");
    } finally {
      setPublishLoading(false);
    }
  }

  const questionCount = quizQuestions.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "transparent",
            border: `1px solid ${T.cardBorder}`,
            borderRadius: 8,
            color: T.textMuted,
            cursor: "pointer",
            padding: "6px 10px",
            fontSize: 16,
            lineHeight: 1,
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: T.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 2,
            }}
          >
            Quiz detail
          </div>
          <h2
            style={{
              margin: "0 0 6px",
              fontSize: 20,
              fontWeight: 800,
              color: T.textPrimary,
              letterSpacing: "-0.02em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {quiz.title}
          </h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <QuizStatusBadge quiz={quiz} />
            <VisibilityBadge visibility={quiz.visibility} />
            <span style={{ fontSize: 11, color: T.textMuted }}>
              ⏱ {quiz.defaultTimer}s default
            </span>
            <span style={{ fontSize: 11, color: T.textMuted }}>
              {questionCount} question{questionCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      {quiz.description && (
        <p
          style={{
            fontSize: 13,
            color: T.textSecondary,
            lineHeight: 1.6,
            margin: "0 0 16px",
            padding: "10px 14px",
            background: T.pageBg,
            borderRadius: 8,
            border: `1px solid ${T.cardBorder}`,
          }}
        >
          {quiz.description}
        </p>
      )}

      {/* Action bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setShowEditQuiz(true)}
        >
          ✏️ Edit
        </Button>
        {quiz.visibility === "RESTRICTED" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowGroups(true)}
          >
            👥 Groups
          </Button>
        )}
        <Button
          size="sm"
          variant={quiz.isPublished ? "warning" : "success"}
          onClick={togglePublish}
          disabled={publishLoading}
        >
          {publishLoading ? (
            <Spinner size={14} />
          ) : quiz.isPublished ? (
            "Unpublish"
          ) : (
            "Publish"
          )}
        </Button>
      </div>

      {/* Questions in quiz */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: T.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Questions in this quiz
        </div>
        <Button size="sm" onClick={() => setShowAddQs(true)}>
          + Add questions
        </Button>
      </div>

      {error && (
        <p style={{ color: T.danger.text, fontSize: 13, marginBottom: 12 }}>
          {error}
        </p>
      )}

      {loadingQuestions ? (
        <div style={{ textAlign: "center", padding: 32 }}>
          <Spinner />
        </div>
      ) : quizQuestions.length === 0 ? (
        <EmptyState
          icon="❓"
          title="No questions yet"
          subtitle='Click "Add questions" to pick from your question bank.'
        />
      ) : (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {quizQuestions.map((mapping, idx) => {
            const q = mapping.question;
            return (
              <div
                key={mapping.questionId ?? q?.id}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "12px 14px",
                  background: T.pageBg,
                  border: `1px solid ${T.cardBorder}`,
                  borderRadius: 10,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: T.cardBorder,
                    color: T.textMuted,
                    fontSize: 11,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: T.textPrimary,
                      lineHeight: 1.5,
                      marginBottom: 6,
                    }}
                  >
                    {q?.questionText}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Badge
                      label={typeLabel(q?.questionType)}
                      customColors={T.neutral}
                    />
                    <span style={{ fontSize: 11, color: T.textMuted }}>
                      ⏱ {q?.timerSeconds}s
                    </span>
                    {q?.options?.filter((o) => o.isCorrect).length > 0 && (
                      <span style={{ fontSize: 11, color: T.success.text }}>
                        {q.options.filter((o) => o.isCorrect).length} correct
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeQuestion(q?.id)}
                  title="Remove from quiz"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: T.danger.dot,
                    cursor: "pointer",
                    fontSize: 16,
                    padding: "2px 4px",
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <AddQuestionsModal
        open={showAddQs}
        onClose={() => setShowAddQs(false)}
        quiz={quiz}
        alreadyInQuiz={quizQuestions}
        onSaved={fetchQuizQuestions}
      />
      <GroupAssignModal
        open={showGroups}
        onClose={() => setShowGroups(false)}
        quiz={quiz}
        onSaved={onQuizUpdated}
      />
      <QuizFormModal
        open={showEditQuiz}
        onClose={() => setShowEditQuiz(false)}
        quiz={quiz}
        onSaved={onQuizUpdated}
      />
    </div>
  );
}

// ── Quiz List Panel ────────────────────────────────────────────────────────

function QuizListPanel({ quizzes, loading, onSelect, onNew, onDeleted, role }) {
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const filtered = quizzes.filter((q) =>
    q.title.toLowerCase().includes(search.toLowerCase()),
  );

  async function deleteQuiz(quiz) {
    if (!window.confirm(`Delete "${quiz.title}"? This cannot be undone.`))
      return;
    setDeletingId(quiz.id);
    try {
      await quizApi.delete(quiz.id);
      toast("Quiz deleted.", "success");
      onDeleted(quiz.id);
    } catch (err) {
      toast(err.message || "Failed to delete quiz.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <SectionHeader
        title="Quizzes"
        subtitle="Quiz management"
        action={
          <Button onClick={onNew} size="sm">
            + New quiz
          </Button>
        }
      />
      <Input
        placeholder="Search quizzes…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 14 }}
      />

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No quizzes"
          subtitle={
            search
              ? "No quizzes match your search."
              : 'Click "New quiz" to get started.'
          }
        />
      ) : (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {filtered.map((quiz) => (
            <div
              key={quiz.id}
              onClick={() => onSelect(quiz)}
              style={{
                padding: "14px 16px",
                background: T.cardBg,
                border: `1px solid ${T.cardBorder}`,
                borderRadius: 12,
                cursor: "pointer",
                transition: "border-color 0.15s",
                position: "relative",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = T.primary + "60")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = T.cardBorder)
              }
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: T.textPrimary,
                      marginBottom: 6,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {quiz.title}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <QuizStatusBadge quiz={quiz} />
                    <VisibilityBadge visibility={quiz.visibility} />
                    <span style={{ fontSize: 11, color: T.textMuted }}>
                      {quiz._count?.quizQuestions ?? 0} questions
                    </span>
                  </div>
                </div>
                {role === "ADMIN" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteQuiz(quiz);
                    }}
                    disabled={deletingId === quiz.id}
                    title="Delete quiz"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: T.danger.dot,
                      cursor: "pointer",
                      fontSize: 15,
                      padding: "2px 4px",
                      lineHeight: 1,
                      opacity: deletingId === quiz.id ? 0.5 : 1,
                      flexShrink: 0,
                    }}
                  >
                    🗑
                  </button>
                )}
              </div>
              {quiz.createdBy && (
                <div
                  style={{
                    fontSize: 11,
                    color: T.textMuted,
                    marginTop: 6,
                  }}
                >
                  by {quiz.createdBy.fullName}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Question Bank Panel ────────────────────────────────────────────────────

function QuestionBankPanel({ role }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await questionApi.getAll();
      setQuestions(data ?? []);
    } catch (err) {
      setError(err.message || "Failed to load questions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  async function deleteQuestion(q) {
    if (!window.confirm(`Delete this question? It cannot be in any quiz.`))
      return;
    setDeletingId(q.id);
    try {
      await questionApi.delete(q.id);
      toast("Question deleted.", "success");
      setQuestions((prev) => prev.filter((x) => x.id !== q.id));
    } catch (err) {
      toast(err.message || "Failed to delete.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = questions.filter((q) =>
    q.questionText.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <SectionHeader
        title="Question Bank"
        subtitle="Reusable questions"
        action={
          <Button onClick={() => setShowNew(true)} size="sm">
            + New question
          </Button>
        }
      />
      <Input
        placeholder="Search questions…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 14 }}
      />

      {error && (
        <p style={{ color: T.danger.text, fontSize: 13, marginBottom: 12 }}>
          {error}
        </p>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="💡"
          title="No questions"
          subtitle={
            search
              ? "No questions match your search."
              : 'Click "New question" to create one.'
          }
        />
      ) : (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {filtered.map((q) => (
            <div
              key={q.id}
              style={{
                padding: "12px 14px",
                background: T.cardBg,
                border: `1px solid ${T.cardBorder}`,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: T.textPrimary,
                      lineHeight: 1.5,
                      marginBottom: 6,
                    }}
                  >
                    {q.questionText}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Badge
                      label={typeLabel(q.questionType)}
                      customColors={T.neutral}
                    />
                    <span style={{ fontSize: 11, color: T.textMuted }}>
                      ⏱ {q.timerSeconds}s
                    </span>
                    {q.options?.length > 0 && (
                      <span style={{ fontSize: 11, color: T.textMuted }}>
                        {q.options.length} options ·{" "}
                        <span style={{ color: T.success.text }}>
                          {q.options.filter((o) => o.isCorrect).length} correct
                        </span>
                      </span>
                    )}
                  </div>
                  {/* Options preview */}
                  {q.options?.length > 0 && (
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                      }}
                    >
                      {q.options.map((opt) => (
                        <div
                          key={opt.id}
                          style={{
                            fontSize: 11,
                            color: opt.isCorrect ? T.success.text : T.textMuted,
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: opt.isCorrect
                                ? T.success.dot
                                : T.cardBorder,
                              flexShrink: 0,
                            }}
                          />
                          {opt.optionText}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => setEditTarget(q)}
                    title="Edit question"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: T.textMuted,
                      cursor: "pointer",
                      fontSize: 14,
                      padding: "2px 4px",
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => deleteQuestion(q)}
                    disabled={deletingId === q.id}
                    title="Delete question"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: T.danger.dot,
                      cursor: "pointer",
                      fontSize: 14,
                      padding: "2px 4px",
                      opacity: deletingId === q.id ? 0.5 : 1,
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <QuestionFormModal
        open={showNew}
        onClose={() => setShowNew(false)}
        question={null}
        onSaved={fetchQuestions}
      />
      <QuestionFormModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        question={editTarget}
        onSaved={() => {
          fetchQuestions();
          setEditTarget(null);
        }}
      />
    </div>
  );
}

// ── Root Page ──────────────────────────────────────────────────────────────

export default function QuizzesPage() {
  const { role } = useAuth();

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [showNewQuiz, setShowNewQuiz] = useState(false);
  const [activeTab, setActiveTab] = useState("quizzes"); // "quizzes" | "bank"

  const fetchQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await quizApi.getAll();
      setQuizzes(data ?? []);
      // Refresh selectedQuiz if open
      if (selectedQuiz) {
        const updated = (data ?? []).find((q) => q.id === selectedQuiz.id);
        setSelectedQuiz(updated ?? null);
      }
    } catch (err) {
      toast(err.message || "Failed to load quizzes.", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedQuiz?.id]);

  useEffect(() => {
    fetchQuizzes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleQuizDeleted(deletedId) {
    setQuizzes((prev) => prev.filter((q) => q.id !== deletedId));
    if (selectedQuiz?.id === deletedId) setSelectedQuiz(null);
  }

  return (
    <div
      style={{
        padding: "32px 40px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: T.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 2,
          }}
        >
          Content
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 800,
            color: T.textPrimary,
            letterSpacing: "-0.03em",
          }}
        >
          Quiz Management
        </h1>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 20,
          borderBottom: `1px solid ${T.cardBorder}`,
        }}
      >
        {[
          { key: "quizzes", label: "Quizzes" },
          { key: "bank", label: "Question Bank" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setSelectedQuiz(null);
            }}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${activeTab === tab.key ? T.primary : "transparent"}`,
              color: activeTab === tab.key ? T.primary : T.textMuted,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 700,
              padding: "10px 20px",
              transition: "all 0.15s",
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {activeTab === "quizzes" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: selectedQuiz ? "1fr 1.4fr" : "1fr",
              gap: 20,
              height: "100%",
            }}
          >
            {/* Quiz list */}
            <Card
              style={{
                padding: 20,
                display: "flex",
                flexDirection: "column",
                height: "calc(100vh - 240px)",
                overflow: "hidden",
              }}
            >
              <QuizListPanel
                quizzes={quizzes}
                loading={loading}
                onSelect={(quiz) => setSelectedQuiz(quiz)}
                onNew={() => setShowNewQuiz(true)}
                onDeleted={handleQuizDeleted}
                role={role}
              />
            </Card>

            {/* Quiz detail */}
            {selectedQuiz && (
              <Card
                style={{
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  height: "calc(100vh - 240px)",
                  overflow: "hidden",
                }}
              >
                <QuizDetailPanel
                  quiz={selectedQuiz}
                  onBack={() => setSelectedQuiz(null)}
                  onQuizUpdated={fetchQuizzes}
                  role={role}
                />
              </Card>
            )}
          </div>
        )}

        {activeTab === "bank" && (
          <Card
            style={{
              padding: 20,
              height: "calc(100vh - 240px)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <QuestionBankPanel role={role} />
          </Card>
        )}
      </div>

      {/* New quiz modal */}
      <QuizFormModal
        open={showNewQuiz}
        onClose={() => setShowNewQuiz(false)}
        quiz={null}
        onSaved={fetchQuizzes}
      />
    </div>
  );
}
