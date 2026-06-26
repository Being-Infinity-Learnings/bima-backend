// Quiz management page for admins and authors.
//
// Status lifecycle: DRAFT → SCHEDULED → LIVE → COMPLETED
// Features: quiz CRUD with scheduling, inline question creation during quiz setup,
// question bank CRUD, clickable questions to view/edit, group assignment.

import { useState, useEffect, useCallback, useRef } from "react";
import {
  quizApi,
  questionApi,
  quizCompositionApi,
  groupsApi,
  uploadApi,
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
  DateTimePicker,
  toast,
} from "../../components/ui/index.jsx";
import APP_CONFIG from "../../config/app.config.js";

const T = APP_CONFIG.theme;

// ─────────────────────────────────────────────────────────────────────────────
// Constants & pure helpers
// ─────────────────────────────────────────────────────────────────────────────

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

// Quiz status metadata: color, label, and what actions are available.
const STATUS_META = {
  DRAFT: {
    colors: T.neutral,
    label: "Draft",
    canPublish: true,
    canUnpublish: false,
    canEdit: true,
    canDelete: true,
  },
  SCHEDULED: {
    colors: T.info,
    label: "Scheduled",
    canPublish: false,
    canUnpublish: true,
    canEdit: true,
    canDelete: false,
  },
  LIVE: {
    colors: T.warning,
    label: "Live",
    canPublish: false,
    canUnpublish: false,
    canEdit: false,
    canDelete: false,
  },
  COMPLETED: {
    colors: { bg: "#052e16", text: "#bbf7d0", dot: "#22c55e" },
    label: "Completed",
    canPublish: false,
    canUnpublish: false,
    canEdit: false,
    canDelete: false,
  },
};

function typeLabel(t) {
  return QUESTION_TYPES.find((x) => x.value === t)?.label ?? t;
}

function formatSchedule(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function quizStatus(quiz) {
  return quiz?.status ?? "DRAFT";
}

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable display pieces
// ─────────────────────────────────────────────────────────────────────────────

function QuizStatusBadge({ quiz }) {
  const status = quizStatus(quiz);
  const meta = STATUS_META[status] ?? STATUS_META.DRAFT;
  return <Badge label={meta.label} customColors={meta.colors} />;
}

function VisibilityBadge({ visibility }) {
  if (visibility === "RESTRICTED")
    return <Badge label="Restricted" customColors={T.warning} />;
  return <Badge label="Public" customColors={T.info} />;
}

function SectionHeader({ eyebrow, title, action }) {
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
          {eyebrow}
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

// Inline field row used inside detail panels.
function InfoRow({ label, children }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: T.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          minWidth: 110,
          paddingTop: 1,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: T.textSecondary }}>{children}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Question Form — used both in bank and as inline step during quiz creation
// ─────────────────────────────────────────────────────────────────────────────

function defaultOptions() {
  return [
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// ImageUploader — drag-and-drop / click-to-browse image picker with preview
// folder: one of the backend's ALLOWED_FOLDERS
// value:  current image URL (string | null)
// onChange: called with the uploaded CDN URL, or null when cleared
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];
const ALLOWED_EXT_LABEL = "PNG, JPG or WebP";

function ImageUploader({ label, folder, value, onChange, hint }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  async function processFile(file) {
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      setError(`Only ${ALLOWED_EXT_LABEL} files are allowed.`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File must be under 5 MB.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const url = await uploadApi.uploadFile(file, folder);
      onChange(url);
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleInputChange(e) {
    processFile(e.target.files?.[0]);
    // Reset so same file can be re-selected after clear
    e.target.value = "";
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    processFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div>
      {label && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: T.textSecondary,
            marginBottom: 6,
          }}
        >
          {label}
          {hint && (
            <span
              style={{ fontWeight: 400, color: T.textMuted, marginLeft: 6 }}
            >
              {hint}
            </span>
          )}
        </div>
      )}

      {value ? (
        // ── Preview state ──────────────────────────────────────────────
        <div
          style={{
            position: "relative",
            borderRadius: 10,
            overflow: "hidden",
            border: `1px solid ${T.cardBorder}`,
            background: T.pageBg,
          }}
        >
          <img
            src={value}
            alt="Uploaded preview"
            style={{
              width: "100%",
              height: 140,
              objectFit: "contain",
              display: "block",
              background: T.pageBg,
              objectFit: "cover",
              display: "block",
            }}
          />
          {/* Overlay on hover */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              opacity: 0,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = 0)}
          >
            <button
              onClick={() => inputRef.current?.click()}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 7,
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 14px",
                cursor: "pointer",
                fontFamily: "inherit",
                backdropFilter: "blur(4px)",
              }}
            >
              Replace
            </button>
            <button
              onClick={() => onChange(null)}
              style={{
                background: "rgba(220,38,38,0.2)",
                border: "1px solid rgba(220,38,38,0.5)",
                borderRadius: 7,
                color: "#fca5a5",
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 14px",
                cursor: "pointer",
                fontFamily: "inherit",
                backdropFilter: "blur(4px)",
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        // ── Drop zone ──────────────────────────────────────────────────
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: `1.5px dashed ${dragOver ? T.primary : uploading ? T.primary + "60" : T.cardBorder}`,
            borderRadius: 10,
            padding: "22px 16px",
            textAlign: "center",
            cursor: uploading ? "default" : "pointer",
            background: dragOver ? `${T.primary}0d` : "transparent",
            transition: "border-color 0.15s, background 0.15s",
            userSelect: "none",
          }}
        >
          {uploading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Spinner size={22} />
              <span style={{ fontSize: 12, color: T.textMuted }}>
                Uploading…
              </span>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 26, marginBottom: 6, lineHeight: 1 }}>
                🖼️
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.textSecondary,
                  marginBottom: 3,
                }}
              >
                Drop image here or{" "}
                <span style={{ color: T.primary, textDecoration: "underline" }}>
                  browse
                </span>
              </div>
              <div style={{ fontSize: 11, color: T.textMuted }}>
                {ALLOWED_EXT_LABEL} · max 5 MB
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <p style={{ fontSize: 11, color: T.danger.text, margin: "5px 0 0" }}>
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_MIME.join(",")}
        onChange={handleInputChange}
        style={{ display: "none" }}
      />
    </div>
  );
}

const MAX_OPTIONS = 6;

// QuestionForm is a pure controlled component so it can be embedded anywhere.
function QuestionForm({
  initial,
  onSave,
  onCancel,
  saveLabel = "Save question",
  compact = false,
}) {
  const [questionText, setQuestionText] = useState(initial?.questionText ?? "");
  const [questionType, setQuestionType] = useState(
    initial?.questionType ?? "SINGLE_CORRECT",
  );
  const [customTimer, setCustomTimer] = useState(
    initial?.customTimer != null ? String(initial.customTimer) : "",
  );
  const [options, setOptions] = useState(
    initial?.options?.length
      ? initial.options.map((o) => ({
          optionText: o.optionText,
          isCorrect: o.isCorrect,
        }))
      : defaultOptions(),
  );
  const [imageUrl, setImageUrl] = useState(initial?.mediaUrl ?? null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isTextBased = questionType === "TEXT" || questionType === "NUMERIC";

  function setOption(idx, field, value) {
    setOptions((prev) => {
      const next = prev.map((o, i) => ({ ...o }));
      if (field === "isCorrect" && questionType === "SINGLE_CORRECT") {
        next.forEach((o, i) => {
          next[i].isCorrect = i === idx;
        });
      } else {
        next[idx][field] = value;
      }
      return next;
    });
  }

  function addOption() {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, { optionText: "", isCorrect: false }]);
  }

  function removeOption(idx) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!questionText.trim()) {
      setError("Question text is required.");
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
    const timer = customTimer.trim() ? parseInt(customTimer, 10) : null;
    if (timer !== null && (isNaN(timer) || timer <= 0)) {
      setError("Custom timer must be a positive number of seconds.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        questionText: questionText.trim(),
        questionType,
        customTimer: timer,
        mediaUrl: imageUrl ?? null,
        options: isTextBased
          ? []
          : options.map((o) => ({
              optionText: o.optionText.trim(),
              isCorrect: o.isCorrect,
            })),
      });
    } catch (err) {
      setError(err.message || "Failed to save question.");
      setSaving(false);
    }
  }

  const gap = compact ? 10 : 14;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      <Textarea
        label="Question text"
        value={questionText}
        onChange={(e) => setQuestionText(e.target.value)}
        placeholder="Type the question here…"
        rows={compact ? 2 : 3}
      />

      <ImageUploader
        label="Question image"
        hint="(optional)"
        folder="question-images"
        value={imageUrl}
        onChange={setImageUrl}
      />

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <Select
            label="Type"
            value={questionType}
            onChange={(e) => setQuestionType(e.target.value)}
            options={QUESTION_TYPES}
          />
        </div>
        <div style={{ width: 170 }}>
          <Input
            label="Custom timer (sec, optional)"
            type="number"
            min={1}
            value={customTimer}
            onChange={(e) => setCustomTimer(e.target.value)}
            placeholder="Uses quiz default"
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
            Answer options —{" "}
            <span style={{ fontWeight: 400, color: T.textMuted }}>
              tick correct{" "}
              {questionType === "MULTI_CORRECT" ? "answers" : "answer"}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {options.map((opt, idx) => (
              <div
                key={idx}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <input
                  type={questionType === "MULTI_CORRECT" ? "checkbox" : "radio"}
                  checked={opt.isCorrect}
                  onChange={(e) =>
                    setOption(idx, "isCorrect", e.target.checked)
                  }
                  style={{
                    accentColor: T.primary,
                    width: 15,
                    height: 15,
                    flexShrink: 0,
                    cursor: "pointer",
                  }}
                />
                <input
                  value={opt.optionText}
                  onChange={(e) => setOption(idx, "optionText", e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  style={{
                    flex: 1,
                    background: T.pageBg,
                    border: `1px solid ${T.cardBorder}`,
                    borderRadius: 8,
                    padding: "7px 11px",
                    color: T.textPrimary,
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  onClick={() => removeOption(idx)}
                  disabled={options.length <= 2}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: options.length > 2 ? T.danger.dot : T.cardBorder,
                    cursor: options.length > 2 ? "pointer" : "default",
                    fontSize: 18,
                    padding: "0 3px",
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addOption}
            disabled={options.length >= MAX_OPTIONS}
            style={{
              marginTop: 8,
              background: "transparent",
              border: `1px dashed ${options.length >= MAX_OPTIONS ? T.cardBorder : T.cardBorder}`,
              borderRadius: 8,
              color: options.length >= MAX_OPTIONS ? T.cardBorder : T.textMuted,
              fontSize: 12,
              padding: "6px 14px",
              cursor: options.length >= MAX_OPTIONS ? "not-allowed" : "pointer",
              width: "100%",
              fontFamily: "inherit",
              opacity: options.length >= MAX_OPTIONS ? 0.4 : 1,
            }}
          >
            {options.length >= MAX_OPTIONS
              ? `Max ${MAX_OPTIONS} options`
              : "+ Add option"}
          </button>
        </div>
      )}

      {error && (
        <p style={{ color: T.danger.text, fontSize: 12, margin: 0 }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {onCancel && (
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={saving}
            size="sm"
          >
            Cancel
          </Button>
        )}
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Spinner size={14} color="#fff" /> : saveLabel}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Question Detail / Edit Modal
// ─────────────────────────────────────────────────────────────────────────────

function QuestionModal({ open, onClose, question, onSaved, readOnly = false }) {
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (open) setEditing(false);
  }, [open, question?.id]);

  if (!question) return null;

  async function handleSave(data) {
    await questionApi.update(question.id, data);
    toast("Question updated.", "success");
    onSaved?.();
    onClose();
  }

  const isTextBased =
    question.questionType === "TEXT" || question.questionType === "NUMERIC";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit question" : "Question detail"}
      width={700}
    >
      {editing ? (
        <QuestionForm
          initial={question}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          saveLabel="Save changes"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Question text */}
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: T.textPrimary,
              lineHeight: 1.6,
              padding: "12px 14px",
              background: T.pageBg,
              borderRadius: 10,
              border: `1px solid ${T.cardBorder}`,
            }}
          >
            {question.questionText}
          </div>

          {/* Question image (if present) */}
          {question.mediaUrl && (
            <div
              style={{
                borderRadius: 10,
                overflow: "hidden",
                border: `1px solid ${T.cardBorder}`,
                maxWidth: 400,
                alignSelf: "flex-start",
              }}
            >
              <img
                src={question.mediaUrl}
                alt="Question illustration"
                style={{
                  width: "100%",
                  maxHeight: 180,
                  objectFit: "contain",
                  display: "block",
                  background: T.pageBg,
                }}
              />
            </div>
          )}

          {/* Meta */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <InfoRow label="Type">
              <Badge
                label={typeLabel(question.questionType)}
                customColors={T.neutral}
              />
            </InfoRow>
            <InfoRow label="Timer">
              {question.customTimer != null
                ? `${question.customTimer}s (custom)`
                : "Uses quiz default"}
            </InfoRow>
            {question.createdBy && (
              <InfoRow label="Created by">
                {question.createdBy.fullName}
              </InfoRow>
            )}
          </div>

          {/* Options */}
          {!isTextBased && question.options?.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  marginBottom: 8,
                }}
              >
                Options
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {question.options.map((opt) => (
                  <div
                    key={opt.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: opt.isCorrect
                        ? `${T.success.dot}15`
                        : T.pageBg,
                      border: `1px solid ${opt.isCorrect ? T.success.dot + "40" : T.cardBorder}`,
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: opt.isCorrect
                          ? T.success.dot
                          : T.cardBorder,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        color: opt.isCorrect ? T.success.text : T.textSecondary,
                        flex: 1,
                      }}
                    >
                      {opt.optionText}
                    </span>
                    {opt.isCorrect && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: T.success.dot,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Correct
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!readOnly && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                paddingTop: 4,
              }}
            >
              <Button variant="ghost" onClick={onClose} size="sm">
                Close
              </Button>
              <Button onClick={() => setEditing(true)} size="sm">
                Edit question
              </Button>
            </div>
          )}
          {readOnly && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={onClose} size="sm">
                Close
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quiz Form — create and edit, with inline question creation step
// ─────────────────────────────────────────────────────────────────────────────

// Step 1: basic quiz details. Step 2: add questions (only on create).
function QuizFormModal({ open, onClose, quiz, onSaved }) {
  const isEdit = !!quiz;
  const [step, setStep] = useState(1); // 1 = details, 2 = questions (create only)
  const [createdQuizId, setCreatedQuizId] = useState(null);

  // Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [defaultTimer, setDefaultTimer] = useState("30");
  const [scheduledStartTime, setScheduledStartTime] = useState(null);
  const [coverImageUrl, setCoverImageUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 2 — question bank picker + inline creator state
  const [bankQuestions, setBankQuestions] = useState([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bankSearch, setBankSearch] = useState("");
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [addingToQuiz, setAddingToQuiz] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setCreatedQuizId(null);
      setError("");
      setTitle(quiz?.title ?? "");
      setDescription(quiz?.description ?? "");
      setVisibility(quiz?.visibility ?? "PUBLIC");
      setDefaultTimer(String(quiz?.defaultTimer ?? 30));
      setScheduledStartTime(quiz?.scheduledStartTime ?? null);
      setCoverImageUrl(quiz?.coverImageUrl ?? null);
      setSelectedIds(new Set());
      setShowInlineCreate(false);
    }
  }, [open, quiz?.id]);

  async function loadBank() {
    setLoadingBank(true);
    try {
      const data = await questionApi.getAll();
      setBankQuestions(data ?? []);
    } catch {
      // silently ignore — user can still create new questions inline
    } finally {
      setLoadingBank(false);
    }
  }

  async function submitStep1() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const timer = parseInt(defaultTimer, 10);
    if (!timer || timer <= 0) {
      setError("Default timer must be a positive number.");
      return;
    }
    if (!scheduledStartTime) {
      setError("Scheduled start time is required.");
      return;
    }
    if (new Date(scheduledStartTime) <= new Date()) {
      setError("Scheduled start time must be in the future.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        visibility,
        defaultTimer: timer,
        scheduledStartTime: scheduledStartTime,
        coverImageUrl: coverImageUrl ?? null,
      };

      if (isEdit) {
        await quizApi.update(quiz.id, body);
        toast("Quiz updated.", "success");
        onSaved();
        onClose();
      } else {
        const created = await quizApi.create(body);
        setCreatedQuizId(created.id);
        await loadBank();
        setStep(2);
        toast("Quiz created! Now add questions.", "success");
      }
    } catch (err) {
      setError(err.message || "Failed to save quiz.");
    } finally {
      setSaving(false);
    }
  }

  async function handleInlineQuestionCreate(data) {
    const q = await questionApi.create(data);
    toast("Question created.", "success");
    // Add to bank list and auto-select it
    setBankQuestions((prev) => [q, ...prev]);
    setSelectedIds((prev) => new Set([...prev, q.id]));
    setShowInlineCreate(false);
  }

  async function finishStep2() {
    if (selectedIds.size > 0) {
      setAddingToQuiz(true);
      try {
        await quizCompositionApi.addQuestions(createdQuizId, [...selectedIds]);
        toast(
          `${selectedIds.size} question${selectedIds.size > 1 ? "s" : ""} added.`,
          "success",
        );
      } catch (err) {
        toast(err.message || "Couldn't add some questions.", "error");
      } finally {
        setAddingToQuiz(false);
      }
    }
    onSaved();
    onClose();
  }

  const filteredBank = bankQuestions.filter((q) =>
    q.questionText.toLowerCase().includes(bankSearch.toLowerCase()),
  );

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const modalTitle = isEdit
    ? "Edit quiz"
    : step === 1
      ? "New quiz — Details"
      : "New quiz — Add questions";

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} width={700}>
      {step === 1 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ImageUploader
            label="Cover image"
            hint="(optional)"
            folder="quiz-covers"
            value={coverImageUrl}
            onChange={setCoverImageUrl}
          />
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
            placeholder="Short description of this quiz…"
            rows={2}
          />
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Select
                label="Visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                options={VISIBILITY_OPTIONS}
              />
            </div>
            <div style={{ width: 170 }}>
              <Input
                label="Default timer (seconds)"
                type="number"
                min={1}
                value={defaultTimer}
                onChange={(e) => setDefaultTimer(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: T.textSecondary,
                marginBottom: 6,
              }}
            >
              Scheduled start time
            </label>
            <DateTimePicker
              value={scheduledStartTime}
              onChange={setScheduledStartTime}
              placeholder="Pick a date & time…"
            />
          </div>

          {error && (
            <p style={{ color: T.danger.text, fontSize: 12, margin: 0 }}>
              {error}
            </p>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={saving}
              size="sm"
            >
              Cancel
            </Button>
            <Button onClick={submitStep1} disabled={saving} size="sm">
              {saving ? (
                <Spinner size={14} color="#fff" />
              ) : isEdit ? (
                "Save changes"
              ) : (
                "Next — Add questions →"
              )}
            </Button>
          </div>
        </div>
      ) : (
        // Step 2: add questions
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: T.textMuted,
              lineHeight: 1.5,
            }}
          >
            Pick questions from your bank, or create new ones. You can always
            add more later from the quiz detail panel.
          </p>

          {/* Inline question creator */}
          {showInlineCreate ? (
            <div
              style={{
                background: T.pageBg,
                border: `1px solid ${T.primary}40`,
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.primary,
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}
              >
                Create new question
              </div>
              <QuestionForm
                onSave={handleInlineQuestionCreate}
                onCancel={() => setShowInlineCreate(false)}
                saveLabel="Create & add to quiz"
                compact
              />
            </div>
          ) : (
            <button
              onClick={() => setShowInlineCreate(true)}
              style={{
                background: `${T.primary}10`,
                border: `1px dashed ${T.primary}50`,
                borderRadius: 10,
                color: T.primary,
                fontSize: 13,
                fontWeight: 600,
                padding: "9px 14px",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
              }}
            >
              + Create a new question
            </button>
          )}

          {/* Bank picker */}
          <Input
            placeholder="Search question bank…"
            value={bankSearch}
            onChange={(e) => setBankSearch(e.target.value)}
          />

          {loadingBank ? (
            <div style={{ textAlign: "center", padding: 20 }}>
              <Spinner />
            </div>
          ) : (
            <div
              style={{
                maxHeight: 280,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 5,
              }}
            >
              {filteredBank.length === 0 && (
                <p
                  style={{
                    color: T.textMuted,
                    fontSize: 13,
                    textAlign: "center",
                    padding: 16,
                  }}
                >
                  {bankQuestions.length === 0
                    ? "No questions in bank yet."
                    : "No matches."}
                </p>
              )}
              {filteredBank.map((q) => {
                const sel = selectedIds.has(q.id);
                return (
                  <div
                    key={q.id}
                    onClick={() => toggleSelect(q.id)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "9px 11px",
                      borderRadius: 8,
                      background: sel ? `${T.primary}15` : T.pageBg,
                      border: `1px solid ${sel ? T.primary + "50" : T.cardBorder}`,
                      cursor: "pointer",
                      transition: "all 0.12s",
                    }}
                  >
                    <div
                      style={{
                        width: 17,
                        height: 17,
                        borderRadius: 4,
                        border: `2px solid ${sel ? T.primary : T.cardBorder}`,
                        background: sel ? T.primary : "transparent",
                        flexShrink: 0,
                        marginTop: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#000",
                        fontSize: 10,
                        fontWeight: 900,
                        transition: "all 0.12s",
                      }}
                    >
                      {sel && "✓"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: T.textPrimary,
                          lineHeight: 1.4,
                          marginBottom: 3,
                        }}
                      >
                        {q.questionText}
                      </div>
                      <div
                        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                      >
                        <Badge
                          label={typeLabel(q.questionType)}
                          customColors={T.neutral}
                        />
                        {q.customTimer != null && (
                          <span style={{ fontSize: 11, color: T.textMuted }}>
                            ⏱ {q.customTimer}s
                          </span>
                        )}
                        {q.options?.length > 0 && (
                          <span style={{ fontSize: 11, color: T.textMuted }}>
                            {q.options.length} opts
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 4,
            }}
          >
            <span style={{ fontSize: 12, color: T.textMuted }}>
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : "None selected"}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="ghost"
                onClick={finishStep2}
                disabled={addingToQuiz}
                size="sm"
              >
                Skip, finish later
              </Button>
              <Button
                onClick={finishStep2}
                disabled={addingToQuiz || selectedIds.size === 0}
                size="sm"
              >
                {addingToQuiz ? (
                  <Spinner size={14} color="#fff" />
                ) : (
                  `Add ${selectedIds.size || ""} & finish`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Group Assignment Modal
// ─────────────────────────────────────────────────────────────────────────────

function GroupAssignModal({ open, onClose, quiz, onSaved }) {
  const [allGroups, setAllGroups] = useState([]);
  const [assignedIds, setAssignedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
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
  }, [open, quiz?.id]);

  async function toggle(groupId) {
    const isAssigned = assignedIds.has(groupId);
    setActing(true);
    setError("");
    try {
      if (isAssigned) {
        await quizApi.removeGroup(quiz.id, groupId);
        setAssignedIds((prev) => {
          const n = new Set(prev);
          n.delete(groupId);
          return n;
        });
        toast("Group removed.", "success");
      } else {
        await quizApi.addGroups(quiz.id, [groupId]);
        setAssignedIds((prev) => new Set([...prev, groupId]));
        toast("Group added.", "success");
      }
      onSaved?.();
    } catch (err) {
      setError(err.message || "Action failed.");
    } finally {
      setActing(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Assign groups" width={460}>
      {loading ? (
        <div style={{ textAlign: "center", padding: 32 }}>
          <Spinner />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 13, color: T.textMuted, margin: "0 0 4px" }}>
            Changes save immediately.
          </p>
          {allGroups.length === 0 && (
            <p style={{ color: T.textMuted, fontSize: 13 }}>
              No groups exist yet.
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
                  padding: "10px 13px",
                  borderRadius: 8,
                  background: assigned ? `${T.primary}15` : T.pageBg,
                  border: `1px solid ${assigned ? T.primary + "40" : T.cardBorder}`,
                  transition: "all 0.12s",
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
                  disabled={acting}
                >
                  {assigned ? "Remove" : "Add"}
                </Button>
              </div>
            );
          })}
          {error && (
            <p style={{ color: T.danger.text, fontSize: 12, margin: 0 }}>
              {error}
            </p>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 4,
            }}
          >
            <Button variant="ghost" onClick={onClose} size="sm">
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Questions to Quiz Modal (from bank, for existing quizzes)
// ─────────────────────────────────────────────────────────────────────────────

function AddQuestionsModal({ open, onClose, quiz, alreadyInQuiz, onSaved }) {
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected(new Set());
    setSearch("");
    setError("");
    setShowCreate(false);
    questionApi
      .getAll()
      .then((q) => setQuestions(q ?? []))
      .catch((err) => setError(err.message || "Failed to load questions."))
      .finally(() => setLoading(false));
  }, [open]);

  const alreadyIds = new Set(
    (alreadyInQuiz ?? []).map((m) => m.questionId ?? m.question?.id),
  );

  const filtered = questions.filter(
    (q) =>
      !alreadyIds.has(q.id) &&
      q.questionText.toLowerCase().includes(search.toLowerCase()),
  );

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleInlineCreate(data) {
    const q = await questionApi.create(data);
    toast("Question created.", "success");
    setQuestions((prev) => [q, ...prev]);
    setSelected((prev) => new Set([...prev, q.id]));
    setShowCreate(false);
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
    <Modal open={open} onClose={onClose} title="Add questions" width={760}>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {showCreate ? (
          <div
            style={{
              background: T.pageBg,
              border: `1px solid ${T.primary}40`,
              borderRadius: 10,
              padding: 14,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: T.primary,
                marginBottom: 10,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Create new question
            </div>
            <QuestionForm
              onSave={handleInlineCreate}
              onCancel={() => setShowCreate(false)}
              saveLabel="Create & select"
              compact
            />
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              background: `${T.primary}10`,
              border: `1px dashed ${T.primary}50`,
              borderRadius: 10,
              color: T.primary,
              fontSize: 13,
              fontWeight: 600,
              padding: "8px 14px",
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
            }}
          >
            + Create a new question
          </button>
        )}

        <Input
          placeholder="Search bank…"
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
              maxHeight: 340,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 5,
            }}
          >
            {filtered.length === 0 && (
              <p
                style={{
                  color: T.textMuted,
                  fontSize: 13,
                  textAlign: "center",
                  padding: 20,
                }}
              >
                {questions.length === 0
                  ? "No questions in bank."
                  : "All added or no matches."}
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
                    padding: "9px 11px",
                    borderRadius: 8,
                    background: sel ? `${T.primary}15` : T.pageBg,
                    border: `1px solid ${sel ? T.primary + "50" : T.cardBorder}`,
                    cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  <div
                    style={{
                      width: 17,
                      height: 17,
                      borderRadius: 4,
                      border: `2px solid ${sel ? T.primary : T.cardBorder}`,
                      background: sel ? T.primary : "transparent",
                      flexShrink: 0,
                      marginTop: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#000",
                      fontSize: 10,
                      fontWeight: 900,
                    }}
                  >
                    {sel && "✓"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: T.textPrimary,
                        lineHeight: 1.4,
                        marginBottom: 3,
                      }}
                    >
                      {q.questionText}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Badge
                        label={typeLabel(q.questionType)}
                        customColors={T.neutral}
                      />
                      {q.customTimer != null && (
                        <span style={{ fontSize: 11, color: T.textMuted }}>
                          ⏱ {q.customTimer}s
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
          <p style={{ color: T.danger.text, fontSize: 12, margin: 0 }}>
            {error}
          </p>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 12, color: T.textMuted }}>
            {selected.size > 0
              ? `${selected.size} selected`
              : "Select questions"}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={saving}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={addSelected}
              disabled={saving || selected.size === 0}
              size="sm"
            >
              {saving ? (
                <Spinner size={14} color="#fff" />
              ) : (
                `Add ${selected.size || ""}`
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quiz Detail Panel
// ─────────────────────────────────────────────────────────────────────────────

function QuizDetailPanel({ quiz, onBack, onQuizUpdated, role }) {
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [loadingQs, setLoadingQs] = useState(false);
  const [showAddQs, setShowAddQs] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [viewQuestion, setViewQuestion] = useState(null);

  // Drag-and-drop reorder state
  const dragIndexRef = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const status = quizStatus(quiz);
  const meta = STATUS_META[status] ?? STATUS_META.DRAFT;
  const canEditContent = status === "DRAFT" || status === "SCHEDULED";

  const fetchQuizQuestions = useCallback(async () => {
    setLoadingQs(true);
    try {
      const data = await quizCompositionApi.getQuestions(quiz.id);
      setQuizQuestions(data ?? []);
      setOrderDirty(false);
    } catch {
      // non-fatal
    } finally {
      setLoadingQs(false);
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
      toast(err.message || "Failed to remove.", "error");
    }
  }

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragStart(e, idx) {
    dragIndexRef.current = idx;
    e.dataTransfer.effectAllowed = "move";
    // Tiny delay so the browser snapshot doesn't show the hover state
    requestAnimationFrame(() => {
      e.target.style.opacity = "0.4";
    });
  }

  function handleDragEnd(e) {
    e.target.style.opacity = "1";
    setDragOverIdx(null);
  }

  function handleDragOver(e, idx) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (idx !== dragOverIdx) setDragOverIdx(idx);
  }

  function handleDragLeave() {
    setDragOverIdx(null);
  }

  function handleDrop(e, dropIdx) {
    e.preventDefault();
    setDragOverIdx(null);
    const fromIdx = dragIndexRef.current;
    dragIndexRef.current = null;
    if (fromIdx === null || fromIdx === dropIdx) return;

    // Update local order only — don't touch the backend yet
    const reordered = [...quizQuestions];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setQuizQuestions(reordered);
    setOrderDirty(true);
  }

  async function saveOrder() {
    setSavingOrder(true);
    try {
      const orderedIds = quizQuestions.map(
        (m) => m.questionId ?? m.question?.id,
      );
      await quizCompositionApi.reorderQuestions(quiz.id, orderedIds);
      toast("Order saved.", "success");
      setOrderDirty(false);
    } catch (err) {
      toast(err.message || "Failed to save order.", "error");
    } finally {
      setSavingOrder(false);
    }
  }

  function discardOrder() {
    setOrderDirty(false);
    fetchQuizQuestions();
  }

  async function handlePublishToggle() {
    setPublishLoading(true);
    try {
      if (meta.canPublish) {
        await quizApi.publish(quiz.id);
        toast("Quiz scheduled!", "success");
      } else if (meta.canUnpublish) {
        await quizApi.unpublish(quiz.id);
        toast("Quiz moved back to draft.", "success");
      }
      onQuizUpdated();
    } catch (err) {
      toast(err.message || "Action failed.", "error");
    } finally {
      setPublishLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: 0,
      }}
    >
      {/* Back + title */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 16,
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
            padding: "5px 9px",
            fontSize: 15,
            lineHeight: 1,
            flexShrink: 0,
            marginTop: 3,
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
              fontSize: 18,
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
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <QuizStatusBadge quiz={quiz} />
            <VisibilityBadge visibility={quiz.visibility} />
            <span style={{ fontSize: 11, color: T.textMuted }}>
              ⏱ {quiz.defaultTimer}s default
            </span>
            <span style={{ fontSize: 11, color: T.textMuted }}>
              📅 {formatSchedule(quiz.scheduledStartTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Cover image */}
      {quiz.coverImageUrl && (
        <div
          style={{
            borderRadius: 10,
            overflow: "hidden",
            border: `1px solid ${T.cardBorder}`,
            marginBottom: 14,
            flexShrink: 0,
            maxWidth: 480,
            alignSelf: "flex-start",
          }}
        >
          <img
            src={quiz.coverImageUrl}
            alt={quiz.title}
            style={{
              width: "100%",
              height: 160,
              objectFit: "contain",
              display: "block",
              background: T.pageBg,
            }}
          />
        </div>
      )}

      {/* Description */}
      {quiz.description && (
        <p
          style={{
            fontSize: 13,
            color: T.textSecondary,
            lineHeight: 1.6,
            margin: "0 0 14px",
            padding: "9px 13px",
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
        style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 18 }}
      >
        {meta.canEdit && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowEdit(true)}
          >
            ✏️ Edit
          </Button>
        )}
        {quiz.visibility === "RESTRICTED" && canEditContent && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowGroups(true)}
          >
            👥 Groups
          </Button>
        )}
        {meta.canPublish && (
          <Button
            size="sm"
            variant="success"
            onClick={handlePublishToggle}
            disabled={publishLoading}
          >
            {publishLoading ? <Spinner size={13} /> : "Schedule quiz →"}
          </Button>
        )}
        {meta.canUnpublish && (
          <Button
            size="sm"
            variant="warning"
            onClick={handlePublishToggle}
            disabled={publishLoading}
          >
            {publishLoading ? <Spinner size={13} /> : "Move to draft"}
          </Button>
        )}
        {(status === "LIVE" || status === "COMPLETED") && (
          <div
            style={{
              fontSize: 12,
              color: T.textMuted,
              alignSelf: "center",
              padding: "0 4px",
            }}
          >
            {status === "LIVE"
              ? "🔴 Quiz is live — no changes allowed"
              : "✅ Completed"}
          </div>
        )}
      </div>

      {/* Questions header */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: T.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Questions ({quizQuestions.length})
            </div>
            {canEditContent && quizQuestions.length > 1 && !orderDirty && (
              <span style={{ fontSize: 11, color: T.textMuted }}>
                · drag to reorder
              </span>
            )}
          </div>
          {canEditContent && !orderDirty && (
            <Button size="sm" onClick={() => setShowAddQs(true)}>
              + Add questions
            </Button>
          )}
        </div>

        {/* Save order bar — slides in when there are unsaved reorders */}
        {orderDirty && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 8,
              padding: "8px 12px",
              background: `${T.primary}15`,
              border: `1px solid ${T.primary}40`,
              borderRadius: 8,
              gap: 10,
            }}
          >
            <span style={{ fontSize: 12, color: T.primary, fontWeight: 600 }}>
              ↕ Order changed — save when you're done
            </span>
            <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
              <Button
                size="sm"
                variant="ghost"
                onClick={discardOrder}
                disabled={savingOrder}
              >
                Discard
              </Button>
              <Button size="sm" onClick={saveOrder} disabled={savingOrder}>
                {savingOrder ? (
                  <Spinner size={13} color="#fff" />
                ) : (
                  "Save order"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Question list */}
      {loadingQs ? (
        <div style={{ textAlign: "center", padding: 28 }}>
          <Spinner />
        </div>
      ) : quizQuestions.length === 0 ? (
        <EmptyState
          icon="❓"
          title="No questions yet"
          subtitle={
            canEditContent
              ? 'Use "Add questions" to pick from your bank.'
              : "No questions were added."
          }
        />
      ) : (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {quizQuestions.map((mapping, idx) => {
            const q = mapping.question;
            const timer = q?.customTimer ?? quiz.defaultTimer;
            const isDragTarget = dragOverIdx === idx;
            return (
              <div
                key={mapping.questionId ?? q?.id}
                draggable={canEditContent}
                onDragStart={
                  canEditContent ? (e) => handleDragStart(e, idx) : undefined
                }
                onDragEnd={canEditContent ? handleDragEnd : undefined}
                onDragOver={
                  canEditContent ? (e) => handleDragOver(e, idx) : undefined
                }
                onDragLeave={canEditContent ? handleDragLeave : undefined}
                onDrop={canEditContent ? (e) => handleDrop(e, idx) : undefined}
                onClick={() => setViewQuestion(q)}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "10px 13px",
                  background: T.pageBg,
                  border: `1px solid ${isDragTarget ? T.primary : T.cardBorder}`,
                  borderRadius: 10,
                  alignItems: "flex-start",
                  cursor: canEditContent ? "grab" : "pointer",
                  transition:
                    "border-color 0.1s, transform 0.1s, box-shadow 0.1s",
                  boxShadow: isDragTarget ? `0 0 0 2px ${T.primary}30` : "none",
                  transform: isDragTarget ? "scale(1.01)" : "none",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isDragTarget)
                    e.currentTarget.style.borderColor = T.primary + "60";
                }}
                onMouseLeave={(e) => {
                  if (!isDragTarget)
                    e.currentTarget.style.borderColor = T.cardBorder;
                }}
              >
                {/* Drag handle (only when editable) */}
                {canEditContent ? (
                  <div
                    title="Drag to reorder"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2.5,
                      padding: "4px 2px",
                      flexShrink: 0,
                      marginTop: 1,
                      cursor: "grab",
                      opacity: 0.35,
                    }}
                  >
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ display: "flex", gap: 2.5 }}>
                        <div
                          style={{
                            width: 3,
                            height: 3,
                            borderRadius: "50%",
                            background: T.textMuted,
                          }}
                        />
                        <div
                          style={{
                            width: 3,
                            height: 3,
                            borderRadius: "50%",
                            background: T.textMuted,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Position number */}
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: T.cardBorder,
                    color: T.textMuted,
                    fontSize: 10,
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
                      lineHeight: 1.45,
                      marginBottom: 5,
                    }}
                  >
                    {q?.questionText}
                  </div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    <Badge
                      label={typeLabel(q?.questionType)}
                      customColors={T.neutral}
                    />
                    <span style={{ fontSize: 11, color: T.textMuted }}>
                      ⏱ {timer}s{q?.customTimer != null ? " (custom)" : ""}
                    </span>
                    {q?.options?.length > 0 && (
                      <span style={{ fontSize: 11, color: T.success.text }}>
                        {q.options.filter((o) => o.isCorrect).length} correct /{" "}
                        {q.options.length}
                      </span>
                    )}
                  </div>
                </div>

                {canEditContent && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeQuestion(q?.id);
                    }}
                    title="Remove from quiz"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: T.danger.dot,
                      cursor: "pointer",
                      fontSize: 16,
                      padding: "1px 3px",
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <QuestionModal
        open={!!viewQuestion}
        onClose={() => setViewQuestion(null)}
        question={viewQuestion}
        onSaved={() => {
          fetchQuizQuestions();
          setViewQuestion(null);
        }}
        readOnly={!canEditContent}
      />
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
        open={showEdit}
        onClose={() => setShowEdit(false)}
        quiz={quiz}
        onSaved={onQuizUpdated}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quiz List Panel
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ["ALL", "DRAFT", "SCHEDULED", "LIVE", "COMPLETED"];

function QuizListPanel({ quizzes, loading, onSelect, onNew, onDeleted, role }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [deletingId, setDeletingId] = useState(null);

  const filtered = quizzes.filter((q) => {
    const matchSearch = q.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "ALL" || quizStatus(q) === statusFilter;
    return matchSearch && matchStatus;
  });

  async function deleteQuiz(quiz, e) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${quiz.title}"? This cannot be undone.`))
      return;
    setDeletingId(quiz.id);
    try {
      await quizApi.delete(quiz.id);
      toast("Quiz deleted.", "success");
      onDeleted(quiz.id);
    } catch (err) {
      toast(err.message || "Failed to delete.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <SectionHeader
        eyebrow="Quiz management"
        title="Quizzes"
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
        style={{ marginBottom: 10 }}
      />

      {/* Status filter pills */}
      <div
        style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}
      >
        {STATUS_FILTERS.map((s) => {
          const active = statusFilter === s;
          const meta = s === "ALL" ? null : STATUS_META[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                background: active
                  ? (meta?.colors.bg ?? T.primary + "20")
                  : "transparent",
                border: `1px solid ${active ? (meta?.colors.dot ?? T.primary) + "60" : T.cardBorder}`,
                borderRadius: 999,
                color: active ? (meta?.colors.text ?? T.primary) : T.textMuted,
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 11px",
                cursor: "pointer",
                fontFamily: "inherit",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                transition: "all 0.12s",
              }}
            >
              {s === "ALL" ? "All" : (meta?.label ?? s)}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No quizzes"
          subtitle={
            search || statusFilter !== "ALL"
              ? "No matches."
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
            gap: 7,
          }}
        >
          {filtered.map((quiz) => {
            const status = quizStatus(quiz);
            const meta = STATUS_META[status] ?? STATUS_META.DRAFT;
            return (
              <div
                key={quiz.id}
                onClick={() => onSelect(quiz)}
                style={{
                  padding: "12px 14px",
                  background: T.cardBg,
                  border: `1px solid ${T.cardBorder}`,
                  borderRadius: 12,
                  cursor: "pointer",
                  transition: "border-color 0.12s",
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
                  {/* Cover thumbnail */}
                  {quiz.coverImageUrl && (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        overflow: "hidden",
                        flexShrink: 0,
                        border: `1px solid ${T.cardBorder}`,
                      }}
                    >
                      <img
                        src={quiz.coverImageUrl}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </div>
                  )}
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
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <Badge label={meta.label} customColors={meta.colors} />
                      <VisibilityBadge visibility={quiz.visibility} />
                      <span style={{ fontSize: 11, color: T.textMuted }}>
                        {quiz._count?.quizQuestions ?? 0} Qs
                      </span>
                      {quiz.scheduledStartTime && (
                        <span style={{ fontSize: 11, color: T.textMuted }}>
                          📅 {formatSchedule(quiz.scheduledStartTime)}
                        </span>
                      )}
                    </div>
                    {quiz.createdBy && (
                      <div
                        style={{
                          fontSize: 11,
                          color: T.textMuted,
                          marginTop: 5,
                        }}
                      >
                        by {quiz.createdBy.fullName}
                      </div>
                    )}
                  </div>
                  {meta.canDelete && role === "ADMIN" && (
                    <button
                      onClick={(e) => deleteQuiz(quiz, e)}
                      disabled={deletingId === quiz.id}
                      title="Delete"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: T.danger.dot,
                        cursor: "pointer",
                        fontSize: 14,
                        padding: "2px 4px",
                        lineHeight: 1,
                        opacity: deletingId === quiz.id ? 0.5 : 0.7,
                        flexShrink: 0,
                      }}
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Question Bank Panel
// ─────────────────────────────────────────────────────────────────────────────

function QuestionBankPanel() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [viewQuestion, setViewQuestion] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await questionApi.getAll();
      setQuestions(data ?? []);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  async function handleCreate(data) {
    const q = await questionApi.create(data);
    toast("Question created.", "success");
    setQuestions((prev) => [q, ...prev]);
    setShowNew(false);
  }

  async function deleteQuestion(q, e) {
    e.stopPropagation();
    if (
      !window.confirm("Delete this question? It must not be used in any quiz.")
    )
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
        eyebrow="Reusable questions"
        title="Question Bank"
        action={
          showNew ? null : (
            <Button onClick={() => setShowNew(true)} size="sm">
              + New question
            </Button>
          )
        }
      />

      <Input
        placeholder="Search questions…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      {/* Two-column layout when creating: form left, list right */}
      <div
        style={{
          flex: 1,
          overflowY: showNew ? "hidden" : "auto",
          display: "flex",
          flexDirection: showNew ? "row" : "column",
          gap: showNew ? 18 : 7,
          minHeight: 0,
        }}
      >
        {/* Inline creator — left column, fixed width */}
        {showNew && (
          <div
            style={{
              width: 400,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            <div
              style={{
                background: T.pageBg,
                border: `1px solid ${T.primary}40`,
                borderRadius: 10,
                padding: 16,
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.primary,
                  marginBottom: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}
              >
                New question
              </div>
              <QuestionForm
                onSave={handleCreate}
                onCancel={() => setShowNew(false)}
                saveLabel="Create question"
              />
            </div>
          </div>
        )}

        {/* Question list — scrollable right column (or full width when not creating) */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 7,
          }}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Spinner />
            </div>
          ) : filtered.length === 0 && !showNew ? (
            <EmptyState
              icon="💡"
              title="No questions"
              subtitle={
                search ? "No matches." : 'Click "New question" to create one.'
              }
            />
          ) : (
            filtered.map((q) => (
              <div
                key={q.id}
                onClick={() => setViewQuestion(q)}
                style={{
                  padding: "11px 13px",
                  background: T.cardBg,
                  border: `1px solid ${T.cardBorder}`,
                  borderRadius: 10,
                  cursor: "pointer",
                  transition: "border-color 0.12s",
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
                        fontSize: 13,
                        color: T.textPrimary,
                        lineHeight: 1.45,
                        marginBottom: 6,
                      }}
                    >
                      {q.questionText}
                    </div>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                      <Badge
                        label={typeLabel(q.questionType)}
                        customColors={T.neutral}
                      />
                      {q.customTimer != null ? (
                        <span style={{ fontSize: 11, color: T.textMuted }}>
                          ⏱ {q.customTimer}s
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: T.textMuted }}>
                          ⏱ quiz default
                        </span>
                      )}
                      {q.options?.length > 0 && (
                        <span style={{ fontSize: 11, color: T.textMuted }}>
                          {q.options.filter((o) => o.isCorrect).length}/
                          {q.options.length} correct
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteQuestion(q, e)}
                    disabled={deletingId === q.id}
                    title="Delete"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: T.danger.dot,
                      cursor: "pointer",
                      fontSize: 14,
                      padding: "1px 3px",
                      lineHeight: 1,
                      opacity: deletingId === q.id ? 0.5 : 0.7,
                      flexShrink: 0,
                    }}
                  >
                    🗑
                  </button>
                </div>
                {/* Options preview (collapsed) */}
                {q.options?.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 5,
                      marginTop: 7,
                    }}
                  >
                    {q.options.map((opt) => (
                      <span
                        key={opt.id}
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: opt.isCorrect
                            ? `${T.success.dot}20`
                            : T.pageBg,
                          color: opt.isCorrect ? T.success.text : T.textMuted,
                          border: `1px solid ${opt.isCorrect ? T.success.dot + "40" : T.cardBorder}`,
                        }}
                      >
                        {opt.optionText}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Click-to-view/edit modal */}
      <QuestionModal
        open={!!viewQuestion}
        onClose={() => setViewQuestion(null)}
        question={viewQuestion}
        onSaved={() => {
          fetchQuestions();
          setViewQuestion(null);
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quiz Detail Modal — wraps QuizDetailPanel in a large modal
// ─────────────────────────────────────────────────────────────────────────────

function QuizDetailModal({ quiz, onClose, onQuizUpdated, role }) {
  if (!quiz) return null;
  return (
    <Modal open={!!quiz} onClose={onClose} title="Quiz Detail" width={860}>
      <QuizDetailPanel
        quiz={quiz}
        onBack={onClose}
        onQuizUpdated={onQuizUpdated}
        role={role}
      />
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root page
// ─────────────────────────────────────────────────────────────────────────────

export default function QuizzesPage() {
  const { role } = useAuth();

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [showNewQuiz, setShowNewQuiz] = useState(false);
  const [activeTab, setActiveTab] = useState("quizzes");

  const fetchQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await quizApi.getAll();
      setQuizzes(data ?? []);
      // Keep selectedQuiz in sync
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
  }, []);

  function handleQuizDeleted(id) {
    setQuizzes((prev) => prev.filter((q) => q.id !== id));
    if (selectedQuiz?.id === id) setSelectedQuiz(null);
  }

  const panelHeight = "calc(100vh - 200px)";

  return (
    <div
      style={{
        padding: "20px 32px",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 14 }}>
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
            fontSize: 20,
            fontWeight: 800,
            color: T.textPrimary,
            letterSpacing: "-0.02em",
          }}
        >
          Quiz Management
        </h1>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: `1px solid ${T.cardBorder}`,
          marginBottom: 18,
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
              padding: "9px 20px",
              transition: "all 0.12s",
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "quizzes" && (
        <div>
          <Card
            style={{
              padding: 18,
              height: panelHeight,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <QuizListPanel
              quizzes={quizzes}
              loading={loading}
              onSelect={setSelectedQuiz}
              onNew={() => setShowNewQuiz(true)}
              onDeleted={handleQuizDeleted}
              role={role}
            />
          </Card>

          {/* Quiz detail as modal */}
          <QuizDetailModal
            quiz={selectedQuiz}
            onClose={() => setSelectedQuiz(null)}
            onQuizUpdated={fetchQuizzes}
            role={role}
          />
        </div>
      )}

      {activeTab === "bank" && (
        <Card
          style={{
            padding: 18,
            height: panelHeight,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <QuestionBankPanel />
        </Card>
      )}

      <QuizFormModal
        open={showNewQuiz}
        onClose={() => setShowNewQuiz(false)}
        quiz={null}
        onSaved={fetchQuizzes}
      />
    </div>
  );
}
