// Quiz management page for admins and authors.
// Status lifecycle: DRAFT → SCHEDULED → LIVE → COMPLETED

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Trash2,
  Pencil,
  Plus,
  X,
  Check,
  Image as ImageIcon,
  Clock,
  Users,
  CalendarClock,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
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
  Modal,
  EmptyState,
  Spinner,
  Badge,
  DateTimePicker,
  toast,
} from "../../components/ui/index.jsx";
import APP_CONFIG from "../../config/app.config.js";

const T = APP_CONFIG.theme;
const LIMITS = APP_CONFIG.quiz?.limits ?? { questionText: 120, optionText: 50 };

// ─── Constants ────────────────────────────────────────────────────────────────

const QUESTION_TYPES = [
  { value: "SINGLE_CORRECT", label: "Single correct answer" },
  { value: "MULTI_CORRECT", label: "Multiple correct answers" },
  { value: "TEXT", label: "Text answer" },
  { value: "NUMERIC", label: "Numeric answer" },
];

const VISIBILITY_OPTIONS = [
  { value: "PUBLIC", label: "Public — visible to all" },
  { value: "RESTRICTED", label: "Restricted — assigned groups only" },
];

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

const MAX_OPTIONS = 6;
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

function typeLabel(t) {
  return QUESTION_TYPES.find((x) => x.value === t)?.label ?? t;
}
function quizStatus(quiz) {
  return quiz?.status ?? "DRAFT";
}
function formatSchedule(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ─── Style tokens ─────────────────────────────────────────────────────────────

const FIELD_LABEL = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: T.textSecondary,
  marginBottom: 7,
};

const SECTION_LABEL_STYLE = {
  fontSize: 11,
  fontWeight: 700,
  color: T.textMuted,
  textTransform: "uppercase",
  letterSpacing: "0.09em",
};

const INPUT_BASE = {
  width: "100%",
  boxSizing: "border-box",
  background: T.pageBg,
  border: `1.5px solid ${T.cardBorder}`,
  borderRadius: 10,
  padding: "11px 14px",
  color: T.textPrimary,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
};

// ─── Small reusables ──────────────────────────────────────────────────────────

function QuizStatusBadge({ quiz }) {
  const meta = STATUS_META[quizStatus(quiz)] ?? STATUS_META.DRAFT;
  return <Badge label={meta.label} customColors={meta.colors} />;
}

function VisibilityBadge({ visibility }) {
  return visibility === "RESTRICTED" ? (
    <Badge label="Restricted" customColors={T.warning} />
  ) : (
    <Badge label="Public" customColors={T.info} />
  );
}

function IconBtn({ onClick, disabled, title, danger, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        cursor: disabled ? "default" : "pointer",
        color: danger ? T.danger.dot : T.textMuted,
        opacity: disabled ? 0.4 : 1,
        padding: 6,
        borderRadius: 7,
        transition: "color 0.12s, background 0.12s",
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          e.currentTarget.style.background = danger
            ? `${T.danger.dot}20`
            : `${T.textMuted}20`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  loading = false,
}) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={title} width={420}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: T.textSecondary,
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            style={{
              background: T.danger.dot,
              color: "#fff",
              border: "none",
            }}
          >
            {loading ? <Spinner size={14} /> : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── ImageUploader ────────────────────────────────────────────────────────────

function ImageUploader({
  label,
  folder,
  value,
  onChange,
  previewHeight = 150,
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  async function processFile(file) {
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      setError("PNG, JPG or WebP only.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Max file size is 5 MB.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      onChange(await uploadApi.uploadFile(file, folder));
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    processFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div>
      {label && (
        <label style={FIELD_LABEL}>
          {label}{" "}
          <span style={{ fontWeight: 400, color: T.textMuted }}>
            (optional)
          </span>
        </label>
      )}

      {value ? (
        <div
          style={{
            position: "relative",
            borderRadius: 12,
            overflow: "hidden",
            border: `1.5px solid ${T.cardBorder}`,
          }}
        >
          <img
            src={value}
            alt="Preview"
            style={{
              width: "100%",
              height: previewHeight,
              objectFit: "cover",
              display: "block",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.52)",
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
                background: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: 8,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                padding: "7px 18px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Replace
            </button>
            <button
              onClick={() => onChange(null)}
              style={{
                background: "rgba(220,38,38,0.25)",
                border: "1px solid rgba(220,38,38,0.5)",
                borderRadius: 8,
                color: "#fca5a5",
                fontSize: 13,
                fontWeight: 600,
                padding: "7px 18px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragOver ? T.primary : uploading ? T.primary + "60" : T.cardBorder}`,
            borderRadius: 12,
            padding: "32px 20px",
            textAlign: "center",
            cursor: uploading ? "default" : "pointer",
            background: dragOver ? `${T.primary}0d` : T.pageBg,
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
                gap: 10,
              }}
            >
              <Spinner size={24} />
              <span style={{ fontSize: 13, color: T.textMuted }}>
                Uploading…
              </span>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: T.cardBorder,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ImageIcon size={22} color={T.textMuted} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: T.textSecondary,
                    marginBottom: 3,
                  }}
                >
                  Drop image here or{" "}
                  <span style={{ color: T.primary }}>browse files</span>
                </div>
                <div style={{ fontSize: 12, color: T.textMuted }}>
                  PNG, JPG or WebP · max 5 MB
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p
          style={{
            fontSize: 12,
            color: T.danger.text,
            margin: "6px 0 0",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <AlertCircle size={13} /> {error}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_MIME.join(",")}
        onChange={(e) => {
          processFile(e.target.files?.[0]);
          e.target.value = "";
        }}
        style={{ display: "none" }}
      />
    </div>
  );
}

// ─── QuestionForm ─────────────────────────────────────────────────────────────

function defaultOptions() {
  return [
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
  ];
}

function QuestionForm({
  initial,
  onSave,
  onCancel,
  saveLabel = "Save question",
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
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isTextBased = questionType === "TEXT" || questionType === "NUMERIC";

  function setOption(idx, field, val) {
    setOptions((prev) => {
      const next = prev.map((o) => ({ ...o }));
      if (field === "isCorrect" && questionType === "SINGLE_CORRECT") {
        next.forEach((_, i) => {
          next[i].isCorrect = i === idx;
        });
      } else {
        next[idx][field] = val;
      }
      return next;
    });
  }

  async function handleSave() {
    if (!questionText.trim()) {
      setError("Question text is required.");
      return;
    }
    if (questionText.length > LIMITS.questionText) {
      setError(
        `Question text must be ${LIMITS.questionText} characters or fewer.`,
      );
      return;
    }
    if (!isTextBased) {
      if (options.some((o) => !o.optionText.trim())) {
        setError("All options must have text.");
        return;
      }
      if (!options.some((o) => o.isCorrect)) {
        setError("Mark at least one correct answer.");
        return;
      }
      const longOption = options.find(
        (o) => o.optionText.length > LIMITS.optionText,
      );
      if (longOption) {
        setError(
          `Option text must be ${LIMITS.optionText} characters or fewer.`,
        );
        return;
      }
    }
    const timer = customTimer.trim() ? parseInt(customTimer, 10) : null;
    if (timer !== null && (isNaN(timer) || timer <= 0)) {
      setError("Timer must be a positive number.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        questionText: questionText.trim(),
        questionType,
        customTimer: timer,
        imageUrl: imageUrl ?? null,
        options: isTextBased
          ? []
          : options.map((o) => ({
              optionText: o.optionText.trim(),
              isCorrect: o.isCorrect,
            })),
      });
    } catch (err) {
      setError(err.message || "Failed to save.");
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 36 }}>
      {/* ── Left panel: question text + image ── */}
      <div
        style={{
          flex: "0 0 360px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 7,
            }}
          >
            <label style={{ ...FIELD_LABEL, fontSize: 14, margin: 0 }}>
              Question text
            </label>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color:
                  questionText.length > LIMITS.questionText
                    ? T.danger.dot
                    : T.textMuted,
              }}
            >
              {questionText.length} / {LIMITS.questionText}
            </span>
          </div>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Write your question here…"
            rows={7}
            maxLength={LIMITS.questionText}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: T.pageBg,
              border: `1.5px solid ${questionText.length > LIMITS.questionText ? T.danger.dot : T.cardBorder}`,
              borderRadius: 12,
              padding: "14px 16px",
              color: T.textPrimary,
              fontSize: 15,
              lineHeight: 1.65,
              fontFamily: "inherit",
              outline: "none",
              resize: "vertical",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) =>
              (e.target.style.borderColor =
                questionText.length > LIMITS.questionText
                  ? T.danger.dot
                  : T.primary)
            }
            onBlur={(e) =>
              (e.target.style.borderColor =
                questionText.length > LIMITS.questionText
                  ? T.danger.dot
                  : T.cardBorder)
            }
          />
        </div>

        <ImageUploader
          label="Question image"
          folder="question-images"
          value={imageUrl}
          onChange={setImageUrl}
          previewHeight={170}
        />
      </div>

      {/* ── Right panel: type + timer + options ── */}
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}
      >
        {/* Type + Timer */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 170px",
            gap: 16,
            alignItems: "end",
          }}
        >
          <div>
            <label style={{ ...FIELD_LABEL, fontSize: 14 }}>
              Question type
            </label>
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
              style={{
                ...INPUT_BASE,
                appearance: "none",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...FIELD_LABEL, fontSize: 14 }}>
              Timer (seconds)
            </label>
            <input
              type="number"
              min={1}
              value={customTimer}
              onChange={(e) => setCustomTimer(e.target.value)}
              placeholder="Quiz default"
              style={{ ...INPUT_BASE, fontSize: 14 }}
            />
          </div>
        </div>

        {/* Options */}
        {!isTextBased && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <label style={{ ...FIELD_LABEL, fontSize: 14, margin: 0 }}>
                Answer options
                <span
                  style={{ fontWeight: 400, color: T.textMuted, marginLeft: 8 }}
                >
                  — tick the{" "}
                  {questionType === "MULTI_CORRECT"
                    ? "correct ones"
                    : "correct one"}
                </span>
              </label>
              <span style={{ fontSize: 12, color: T.textMuted }}>
                {options.length} / {MAX_OPTIONS}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {options.map((opt, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: `1.5px solid ${opt.isCorrect ? T.success.dot + "55" : T.cardBorder}`,
                    background: opt.isCorrect ? `${T.success.dot}0e` : T.pageBg,
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                >
                  <button
                    onClick={() => setOption(idx, "isCorrect", !opt.isCorrect)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius:
                        questionType === "MULTI_CORRECT" ? 6 : "50%",
                      border: `2px solid ${opt.isCorrect ? T.success.dot : T.cardBorder}`,
                      background: opt.isCorrect ? T.success.dot : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      flexShrink: 0,
                      transition: "all 0.15s",
                    }}
                  >
                    {opt.isCorrect && (
                      <Check size={13} color="#fff" strokeWidth={3} />
                    )}
                  </button>

                  <input
                    value={opt.optionText}
                    onChange={(e) =>
                      setOption(idx, "optionText", e.target.value)
                    }
                    placeholder={`Option ${idx + 1}`}
                    maxLength={LIMITS.optionText}
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      color: T.textPrimary,
                      fontSize: 14,
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color:
                        opt.optionText.length > LIMITS.optionText
                          ? T.danger.dot
                          : T.textMuted,
                      flexShrink: 0,
                      minWidth: 36,
                      textAlign: "right",
                    }}
                  >
                    {opt.optionText.length}/{LIMITS.optionText}
                  </span>

                  {opt.isCorrect && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: T.success.dot,
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        flexShrink: 0,
                      }}
                    >
                      Correct
                    </span>
                  )}

                  <IconBtn
                    onClick={() => {
                      if (options.length > 2)
                        setOptions((p) => p.filter((_, i) => i !== idx));
                    }}
                    disabled={options.length <= 2}
                    title="Remove option"
                    danger
                  >
                    <X size={15} />
                  </IconBtn>
                </div>
              ))}
            </div>

            {options.length < MAX_OPTIONS && (
              <button
                onClick={() =>
                  setOptions((p) => [
                    ...p,
                    { optionText: "", isCorrect: false },
                  ])
                }
                style={{
                  marginTop: 10,
                  width: "100%",
                  background: "transparent",
                  border: `1.5px dashed ${T.cardBorder}`,
                  borderRadius: 12,
                  color: T.textMuted,
                  fontSize: 14,
                  fontWeight: 600,
                  padding: "12px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = T.primary;
                  e.currentTarget.style.color = T.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = T.cardBorder;
                  e.currentTarget.style.color = T.textMuted;
                }}
              >
                <Plus size={16} /> Add option
              </button>
            )}
          </div>
        )}

        {isTextBased && (
          <div
            style={{
              padding: "18px 20px",
              borderRadius: 12,
              border: `1px solid ${T.cardBorder}`,
              background: T.pageBg,
            }}
          >
            <p
              style={{
                fontSize: 14,
                color: T.textMuted,
                margin: 0,
                lineHeight: 1.7,
              }}
            >
              This question type expects a free-form answer — no options needed.
              Students will type their response during the quiz.
            </p>
          </div>
        )}

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: T.danger.text,
              fontSize: 13,
            }}
          >
            <AlertCircle size={15} /> {error}
          </div>
        )}

        <div
          style={{
            marginTop: "auto",
            paddingTop: 16,
            borderTop: `1px solid ${T.cardBorder}`,
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size={15} color="#fff" /> : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── QuestionModal ────────────────────────────────────────────────────────────

function QuestionModal({ open, onClose, question, onSaved, readOnly = false }) {
  const [editing, setEditing] = useState(false);
  const [fullQuestion, setFullQuestion] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (open && question?.id) {
      setEditing(false);
      setFullQuestion(null);
      setLoadingDetail(true);
      questionApi
        .getById(question.id)
        .then((data) => setFullQuestion(data))
        .catch(() => setFullQuestion(question))
        .finally(() => setLoadingDetail(false));
    }
  }, [open, question?.id]);

  const q = fullQuestion ?? question;
  if (!q) return null;

  async function handleSave(data) {
    await questionApi.update(q.id, data);
    toast("Question updated.", "success");
    onSaved?.();
    onClose();
  }

  const isTextBased = q.questionType === "TEXT" || q.questionType === "NUMERIC";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit question" : "Question detail"}
      width={940}
    >
      {editing ? (
        <QuestionForm
          initial={q}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          saveLabel="Save changes"
        />
      ) : loadingDetail ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Spinner />
        </div>
      ) : (
        <div style={{ display: "flex", gap: 32 }}>
          <div
            style={{
              flex: "0 0 360px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: T.textPrimary,
                lineHeight: 1.7,
                padding: "16px 18px",
                background: T.pageBg,
                borderRadius: 12,
                border: `1.5px solid ${T.cardBorder}`,
              }}
            >
              {q.questionText}
            </div>
            {q.imageUrl && (
              <div
                style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  border: `1px solid ${T.cardBorder}`,
                }}
              >
                <img
                  src={q.imageUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: 190,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>
            )}
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ ...SECTION_LABEL_STYLE, minWidth: 60 }}>
                  Type
                </span>
                <Badge
                  label={typeLabel(q.questionType)}
                  customColors={T.neutral}
                />
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ ...SECTION_LABEL_STYLE, minWidth: 60 }}>
                  Timer
                </span>
                <span style={{ fontSize: 13, color: T.textSecondary }}>
                  {q.customTimer != null
                    ? `${q.customTimer}s (custom)`
                    : "Uses quiz default"}
                </span>
              </div>
            </div>

            {!isTextBased && q.options?.length > 0 && (
              <div>
                <div style={{ ...SECTION_LABEL_STYLE, marginBottom: 12 }}>
                  Options
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {q.options.map((opt) => (
                    <div
                      key={opt.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 16px",
                        borderRadius: 10,
                        background: opt.isCorrect
                          ? `${T.success.dot}12`
                          : T.pageBg,
                        border: `1.5px solid ${opt.isCorrect ? T.success.dot + "50" : T.cardBorder}`,
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          flexShrink: 0,
                          background: opt.isCorrect
                            ? T.success.dot
                            : T.cardBorder,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {opt.isCorrect && (
                          <Check size={12} color="#fff" strokeWidth={3} />
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          color: opt.isCorrect ? T.success.text : T.textPrimary,
                          flex: 1,
                          lineHeight: 1.5,
                        }}
                      >
                        {opt.optionText}
                      </span>
                      {opt.isCorrect && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: T.success.dot,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
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

            <div
              style={{
                marginTop: "auto",
                paddingTop: 16,
                borderTop: `1px solid ${T.cardBorder}`,
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              {!readOnly && (
                <Button onClick={() => setEditing(true)}>
                  <Pencil size={14} style={{ marginRight: 6 }} />
                  Edit question
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── QuizFormModal ────────────────────────────────────────────────────────────

function QuizFormModal({ open, onClose, quiz, onSaved }) {
  const isEdit = !!quiz;
  const [step, setStep] = useState(1);
  const [createdQuizId, setCreatedQuizId] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [defaultTimer, setDefaultTimer] = useState("30");
  const [scheduledStartTime, setScheduledStartTime] = useState(null);
  const [coverImageUrl, setCoverImageUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      setBankQuestions((await questionApi.getAll()) ?? []);
    } catch {
      /* silent */
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
        scheduledStartTime,
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

  async function handleInlineCreate(data) {
    const q = await questionApi.create(data);
    toast("Question created.", "success");
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit quiz" : step === 1 ? "New quiz" : "Add questions"}
      width={880}
    >
      {step === 1 ? (
        <div style={{ display: "flex", gap: 32 }}>
          {/* Cover image column */}
          <div style={{ flex: "0 0 230px" }}>
            <ImageUploader
              label="Cover image"
              folder="quiz-covers"
              value={coverImageUrl}
              onChange={setCoverImageUrl}
              previewHeight={190}
            />
          </div>

          {/* Fields column */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div>
              <label style={{ ...FIELD_LABEL, fontSize: 14 }}>Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Biology Chapter 3"
                style={{ ...INPUT_BASE, fontSize: 15 }}
                onFocus={(e) => (e.target.style.borderColor = T.primary)}
                onBlur={(e) => (e.target.style.borderColor = T.cardBorder)}
              />
            </div>

            <div>
              <label style={{ ...FIELD_LABEL, fontSize: 14 }}>
                Description{" "}
                <span style={{ fontWeight: 400, color: T.textMuted }}>
                  (optional)
                </span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description of this quiz…"
                rows={3}
                style={{
                  ...INPUT_BASE,
                  fontSize: 14,
                  resize: "vertical",
                  lineHeight: 1.6,
                }}
                onFocus={(e) => (e.target.style.borderColor = T.primary)}
                onBlur={(e) => (e.target.style.borderColor = T.cardBorder)}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 160px",
                gap: 16,
                alignItems: "end",
              }}
            >
              <div>
                <label style={{ ...FIELD_LABEL, fontSize: 14 }}>
                  Visibility
                </label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  style={{
                    ...INPUT_BASE,
                    appearance: "none",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  {VISIBILITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ ...FIELD_LABEL, fontSize: 14 }}>
                  Default timer (s)
                </label>
                <input
                  type="number"
                  min={1}
                  value={defaultTimer}
                  onChange={(e) => setDefaultTimer(e.target.value)}
                  style={{ ...INPUT_BASE, fontSize: 14 }}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  ...FIELD_LABEL,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <CalendarClock size={15} color={T.textSecondary} /> Scheduled
                start time
              </label>
              <DateTimePicker
                value={scheduledStartTime}
                onChange={setScheduledStartTime}
                placeholder="Pick a date & time…"
              />
            </div>

            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: T.danger.text,
                  fontSize: 13,
                }}
              >
                <AlertCircle size={15} /> {error}
              </div>
            )}

            <div
              style={{
                paddingTop: 12,
                borderTop: `1px solid ${T.cardBorder}`,
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <Button variant="ghost" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={submitStep1} disabled={saving}>
                {saving ? (
                  <Spinner size={15} color="#fff" />
                ) : isEdit ? (
                  "Save changes"
                ) : (
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    Next — Add questions <ArrowRight size={15} />
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: T.textMuted,
              lineHeight: 1.7,
            }}
          >
            Select questions from your bank to include in this quiz. You can
            always add more later.
          </p>

          {showInlineCreate ? (
            <div
              style={{
                background: T.pageBg,
                border: `1.5px solid ${T.primary}40`,
                borderRadius: 14,
                padding: 22,
              }}
            >
              <div
                style={{
                  ...SECTION_LABEL_STYLE,
                  color: T.primary,
                  marginBottom: 16,
                }}
              >
                Create new question
              </div>
              <QuestionForm
                onSave={handleInlineCreate}
                onCancel={() => setShowInlineCreate(false)}
                saveLabel="Create & add to quiz"
              />
            </div>
          ) : (
            <button
              onClick={() => setShowInlineCreate(true)}
              style={{
                background: `${T.primary}0d`,
                border: `1.5px dashed ${T.primary}50`,
                borderRadius: 12,
                color: T.primary,
                fontSize: 14,
                fontWeight: 600,
                padding: "14px 18px",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Plus size={17} /> Create a new question
            </button>
          )}

          <input
            value={bankSearch}
            onChange={(e) => setBankSearch(e.target.value)}
            placeholder="Search question bank…"
            style={{ ...INPUT_BASE, fontSize: 14 }}
          />

          {loadingBank ? (
            <div style={{ textAlign: "center", padding: 28 }}>
              <Spinner />
            </div>
          ) : (
            <div
              style={{
                maxHeight: 340,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {filteredBank.length === 0 && (
                <p
                  style={{
                    color: T.textMuted,
                    fontSize: 14,
                    textAlign: "center",
                    padding: 24,
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
                    onClick={() =>
                      setSelectedIds((prev) => {
                        const n = new Set(prev);
                        sel ? n.delete(q.id) : n.add(q.id);
                        return n;
                      })
                    }
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 14,
                      padding: "13px 16px",
                      borderRadius: 12,
                      background: sel ? `${T.primary}12` : T.pageBg,
                      border: `1.5px solid ${sel ? T.primary + "60" : T.cardBorder}`,
                      cursor: "pointer",
                      transition: "all 0.12s",
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        border: `2px solid ${sel ? T.primary : T.cardBorder}`,
                        background: sel ? T.primary : "transparent",
                        flexShrink: 0,
                        marginTop: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.12s",
                      }}
                    >
                      {sel && <Check size={12} color="#000" strokeWidth={3} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          color: T.textPrimary,
                          lineHeight: 1.55,
                          marginBottom: 5,
                        }}
                      >
                        {q.questionText}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Badge
                          label={typeLabel(q.questionType)}
                          customColors={T.neutral}
                        />
                        {q.options?.length > 0 && (
                          <span style={{ fontSize: 12, color: T.textMuted }}>
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

          <div
            style={{
              paddingTop: 14,
              borderTop: `1px solid ${T.cardBorder}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, color: T.textMuted }}>
              {selectedIds.size > 0
                ? `${selectedIds.size} question${selectedIds.size > 1 ? "s" : ""} selected`
                : "None selected"}
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              <Button
                variant="ghost"
                onClick={finishStep2}
                disabled={addingToQuiz}
              >
                Skip for now
              </Button>
              <Button
                onClick={finishStep2}
                disabled={addingToQuiz || selectedIds.size === 0}
              >
                {addingToQuiz ? (
                  <Spinner size={15} color="#fff" />
                ) : (
                  `Add ${selectedIds.size} & finish`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── GroupAssignModal ─────────────────────────────────────────────────────────

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
    setActing(true);
    setError("");
    try {
      const isAssigned = assignedIds.has(groupId);
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
    <Modal open={open} onClose={onClose} title="Assign groups" width={520}>
      {loading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spinner />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p
            style={{
              fontSize: 14,
              color: T.textMuted,
              margin: "0 0 4px",
              lineHeight: 1.7,
            }}
          >
            Toggle which groups can access this quiz. Changes save immediately.
          </p>
          {allGroups.length === 0 && (
            <p style={{ color: T.textMuted, fontSize: 14 }}>
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
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: assigned ? `${T.primary}12` : T.pageBg,
                  border: `1.5px solid ${assigned ? T.primary + "40" : T.cardBorder}`,
                  transition: "all 0.12s",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: T.textPrimary,
                    }}
                  >
                    {g.name}
                  </div>
                  {g.description && (
                    <div
                      style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}
                    >
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: T.danger.text,
                fontSize: 13,
              }}
            >
              <AlertCircle size={14} />
              {error}
            </div>
          )}
          <div
            style={{
              paddingTop: 12,
              borderTop: `1px solid ${T.cardBorder}`,
              display: "flex",
              justifyContent: "flex-end",
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

// ─── AddQuestionsModal ────────────────────────────────────────────────────────

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
      .catch((e) => setError(e.message || "Failed."))
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
    <Modal open={open} onClose={onClose} title="Add questions" width={820}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {showCreate ? (
          <div
            style={{
              background: T.pageBg,
              border: `1.5px solid ${T.primary}40`,
              borderRadius: 14,
              padding: 22,
            }}
          >
            <div
              style={{
                ...SECTION_LABEL_STYLE,
                color: T.primary,
                marginBottom: 16,
              }}
            >
              Create new question
            </div>
            <QuestionForm
              onSave={handleInlineCreate}
              onCancel={() => setShowCreate(false)}
              saveLabel="Create & select"
            />
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              background: `${T.primary}0d`,
              border: `1.5px dashed ${T.primary}50`,
              borderRadius: 12,
              color: T.primary,
              fontSize: 14,
              fontWeight: 600,
              padding: "14px 18px",
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Plus size={17} /> Create a new question
          </button>
        )}

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search bank…"
          style={{ ...INPUT_BASE, fontSize: 14 }}
        />

        {loading ? (
          <div style={{ textAlign: "center", padding: 28 }}>
            <Spinner />
          </div>
        ) : (
          <div
            style={{
              maxHeight: 400,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {filtered.length === 0 && (
              <p
                style={{
                  color: T.textMuted,
                  fontSize: 14,
                  textAlign: "center",
                  padding: 28,
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
                  onClick={() =>
                    setSelected((p) => {
                      const n = new Set(p);
                      sel ? n.delete(q.id) : n.add(q.id);
                      return n;
                    })
                  }
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    padding: "13px 16px",
                    borderRadius: 12,
                    background: sel ? `${T.primary}12` : T.pageBg,
                    border: `1.5px solid ${sel ? T.primary + "60" : T.cardBorder}`,
                    cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: `2px solid ${sel ? T.primary : T.cardBorder}`,
                      background: sel ? T.primary : "transparent",
                      flexShrink: 0,
                      marginTop: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {sel && <Check size={12} color="#000" strokeWidth={3} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        color: T.textPrimary,
                        lineHeight: 1.55,
                        marginBottom: 5,
                      }}
                    >
                      {q.questionText}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Badge
                        label={typeLabel(q.questionType)}
                        customColors={T.neutral}
                      />
                      {q.customTimer != null && (
                        <span style={{ fontSize: 12, color: T.textMuted }}>
                          Timer: {q.customTimer}s
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: T.danger.text,
              fontSize: 13,
            }}
          >
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <div
          style={{
            paddingTop: 14,
            borderTop: `1px solid ${T.cardBorder}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 13, color: T.textMuted }}>
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
                <Spinner size={15} color="#fff" />
              ) : (
                `Add ${selected.size || ""}`.trim()
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── QuizDetailModal ──────────────────────────────────────────────────────────

function QuizDetailModal({ open, onClose, quiz, onQuizUpdated, role }) {
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [loadingQs, setLoadingQs] = useState(false);
  const [showAddQs, setShowAddQs] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [viewQuestion, setViewQuestion] = useState(null);
  const dragIndexRef = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const status = quiz ? quizStatus(quiz) : "DRAFT";
  const meta = STATUS_META[status] ?? STATUS_META.DRAFT;
  const canEditContent = status === "DRAFT" || status === "SCHEDULED";

  const fetchQuizQuestions = useCallback(async () => {
    if (!quiz) return;
    setLoadingQs(true);
    try {
      setQuizQuestions((await quizCompositionApi.getQuestions(quiz.id)) ?? []);
      setOrderDirty(false);
    } catch {
      /* non-fatal */
    } finally {
      setLoadingQs(false);
    }
  }, [quiz?.id]);

  useEffect(() => {
    if (open && quiz) fetchQuizQuestions();
  }, [open, quiz?.id]);

  async function removeQuestion(questionId) {
    try {
      await quizCompositionApi.removeQuestion(quiz.id, questionId);
      toast("Removed.", "success");
      fetchQuizQuestions();
    } catch (err) {
      toast(err.message || "Failed.", "error");
    }
  }

  function handleDragStart(e, idx) {
    dragIndexRef.current = idx;
    e.dataTransfer.effectAllowed = "move";
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
    const r = [...quizQuestions];
    const [m] = r.splice(fromIdx, 1);
    r.splice(dropIdx, 0, m);
    setQuizQuestions(r);
    setOrderDirty(true);
  }
  async function saveOrder() {
    setSavingOrder(true);
    try {
      await quizCompositionApi.reorderQuestions(
        quiz.id,
        quizQuestions.map((m) => m.questionId ?? m.question?.id),
      );
      toast("Order saved.", "success");
      setOrderDirty(false);
    } catch (err) {
      toast(err.message || "Failed.", "error");
    } finally {
      setSavingOrder(false);
    }
  }
  async function handlePublishToggle() {
    setPublishLoading(true);
    try {
      if (meta.canPublish) {
        await quizApi.publish(quiz.id);
        toast("Quiz scheduled!", "success");
      } else if (meta.canUnpublish) {
        await quizApi.unpublish(quiz.id);
        toast("Moved to draft.", "success");
      }
      onQuizUpdated();
    } catch (err) {
      toast(err.message || "Action failed.", "error");
    } finally {
      setPublishLoading(false);
    }
  }

  if (!quiz) return null;

  return (
    <Modal open={open} onClose={onClose} title="" width={900}>
      {/* Cover */}
      {quiz.coverImageUrl && (
        <div
          style={{
            borderRadius: 14,
            overflow: "hidden",
            border: `1px solid ${T.cardBorder}`,
            marginBottom: 24,
          }}
        >
          <img
            src={quiz.coverImageUrl}
            alt={quiz.title}
            style={{
              width: "100%",
              height: 210,
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 20,
          marginBottom: 18,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: "0 0 10px",
              fontSize: 24,
              fontWeight: 800,
              color: T.textPrimary,
              letterSpacing: "-0.02em",
            }}
          >
            {quiz.title}
          </h2>
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <QuizStatusBadge quiz={quiz} />
            <VisibilityBadge visibility={quiz.visibility} />
            <span
              style={{
                fontSize: 13,
                color: T.textMuted,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Clock size={13} />
              {quiz.defaultTimer}s default
            </span>
            <span
              style={{
                fontSize: 13,
                color: T.textMuted,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <CalendarClock size={13} />
              {formatSchedule(quiz.scheduledStartTime)}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {meta.canEdit && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowEdit(true)}
            >
              <Pencil size={14} style={{ marginRight: 5 }} />
              Edit
            </Button>
          )}
          {quiz.visibility === "RESTRICTED" && canEditContent && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowGroups(true)}
            >
              <Users size={14} style={{ marginRight: 5 }} />
              Groups
            </Button>
          )}
          {meta.canPublish && (
            <Button
              size="sm"
              variant="success"
              onClick={handlePublishToggle}
              disabled={publishLoading}
            >
              {publishLoading ? <Spinner size={13} /> : "Schedule quiz"}
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
            <span
              style={{ fontSize: 13, color: T.textMuted, alignSelf: "center" }}
            >
              {status === "LIVE" ? "Live — read only" : "Completed"}
            </span>
          )}
        </div>
      </div>

      {quiz.description && (
        <p
          style={{
            fontSize: 14,
            color: T.textSecondary,
            lineHeight: 1.75,
            margin: "0 0 20px",
            padding: "14px 16px",
            background: T.pageBg,
            borderRadius: 12,
            border: `1px solid ${T.cardBorder}`,
          }}
        >
          {quiz.description}
        </p>
      )}

      <div
        style={{ height: 1, background: T.cardBorder, margin: "0 0 20px" }}
      />

      {/* Questions header */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: T.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Questions ({quizQuestions.length})
            </span>
            {canEditContent && quizQuestions.length > 1 && !orderDirty && (
              <span style={{ fontSize: 12, color: T.textMuted }}>
                · drag rows to reorder
              </span>
            )}
          </div>
          {canEditContent && !orderDirty && (
            <Button size="sm" onClick={() => setShowAddQs(true)}>
              <Plus size={14} style={{ marginRight: 5 }} />
              Add questions
            </Button>
          )}
        </div>

        {orderDirty && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 12,
              padding: "12px 16px",
              background: `${T.primary}12`,
              border: `1.5px solid ${T.primary}40`,
              borderRadius: 12,
              gap: 12,
            }}
          >
            <span style={{ fontSize: 13, color: T.primary, fontWeight: 600 }}>
              Order changed — save when done
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setOrderDirty(false);
                  fetchQuizQuestions();
                }}
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
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spinner />
        </div>
      ) : quizQuestions.length === 0 ? (
        <EmptyState
          icon=""
          title="No questions yet"
          subtitle={
            canEditContent
              ? 'Click "Add questions" to pick from your bank.'
              : "No questions were added."
          }
        />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: 440,
            overflowY: "auto",
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
                  gap: 14,
                  padding: "14px 16px",
                  background: T.pageBg,
                  border: `1.5px solid ${isDragTarget ? T.primary : T.cardBorder}`,
                  borderRadius: 12,
                  alignItems: "flex-start",
                  cursor: canEditContent ? "grab" : "pointer",
                  transition: "border-color 0.1s, box-shadow 0.1s",
                  boxShadow: isDragTarget ? `0 0 0 3px ${T.primary}25` : "none",
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
                {canEditContent && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                      padding: "3px 1px",
                      flexShrink: 0,
                      opacity: 0.3,
                      marginTop: 3,
                    }}
                  >
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ display: "flex", gap: 3 }}>
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
                )}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: T.cardBorder,
                    color: T.textMuted,
                    fontSize: 12,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </div>
                {q?.imageUrl && (
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 8,
                      overflow: "hidden",
                      border: `1px solid ${T.cardBorder}`,
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={q.imageUrl}
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
                      color: T.textPrimary,
                      lineHeight: 1.6,
                      marginBottom: 7,
                    }}
                  >
                    {q?.questionText}
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Badge
                      label={typeLabel(q?.questionType)}
                      customColors={T.neutral}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        color: T.textMuted,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Clock size={12} />
                      {timer}s{q?.customTimer != null ? " (custom)" : ""}
                    </span>
                    {q?.options?.length > 0 && (
                      <span style={{ fontSize: 12, color: T.success.text }}>
                        {q.options.filter((o) => o.isCorrect).length} correct /{" "}
                        {q.options.length}
                      </span>
                    )}
                  </div>
                </div>
                {canEditContent && (
                  <IconBtn
                    onClick={(e) => {
                      e.stopPropagation();
                      removeQuestion(q?.id);
                    }}
                    title="Remove from quiz"
                    danger
                  >
                    <X size={16} />
                  </IconBtn>
                )}
              </div>
            );
          })}
        </div>
      )}

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
    </Modal>
  );
}

// ─── Quiz List ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ["ALL", "DRAFT", "SCHEDULED", "LIVE", "COMPLETED"];

function QuizListPanel({ quizzes, loading, onSelect, onNew, onDeleted, role }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [deletingId, setDeletingId] = useState(null);
  const [confirmQuiz, setConfirmQuiz] = useState(null);

  const filtered = quizzes.filter(
    (q) =>
      q.title.toLowerCase().includes(search.toLowerCase()) &&
      (statusFilter === "ALL" || quizStatus(q) === statusFilter),
  );

  function deleteQuiz(quiz, e) {
    e.stopPropagation();
    setConfirmQuiz(quiz);
  }

  async function confirmDeleteQuiz() {
    if (!confirmQuiz) return;
    setDeletingId(confirmQuiz.id);
    try {
      await quizApi.delete(confirmQuiz.id);
      toast("Quiz deleted.", "success");
      onDeleted(confirmQuiz.id);
      setConfirmQuiz(null);
    } catch (err) {
      toast(err.message || "Failed.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
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
              marginBottom: 4,
            }}
          >
            Quiz management
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 800,
              color: T.textPrimary,
              letterSpacing: "-0.02em",
            }}
          >
            Quizzes
          </h2>
        </div>
        <Button onClick={onNew}>
          <Plus size={15} style={{ marginRight: 6 }} />
          New quiz
        </Button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search quizzes…"
        style={{ ...INPUT_BASE, fontSize: 14, marginBottom: 16 }}
      />

      <div
        style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 22 }}
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
                padding: "4px 14px",
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
        <div style={{ textAlign: "center", padding: 80 }}>
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon=""
          title="No quizzes"
          subtitle={
            search || statusFilter !== "ALL"
              ? "No matches found."
              : 'Click "New quiz" to get started.'
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
            gap: 16,
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
                  background: T.cardBg,
                  border: `1.5px solid ${T.cardBorder}`,
                  borderRadius: 16,
                  cursor: "pointer",
                  transition: "border-color 0.12s, box-shadow 0.12s",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = T.primary + "60";
                  e.currentTarget.style.boxShadow = `0 6px 28px ${T.primary}18`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = T.cardBorder;
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {quiz.coverImageUrl ? (
                  <div style={{ height: 140, overflow: "hidden" }}>
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
                ) : (
                  <div
                    style={{
                      height: 140,
                      background: T.pageBg,
                      borderBottom: `1.5px solid ${T.cardBorder}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 8,
                        opacity: 0.35,
                      }}
                    >
                      <ImageIcon size={32} color={T.textMuted} />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: T.textMuted,
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                        }}
                      >
                        No image
                      </span>
                    </div>
                  </div>
                )}
                <div
                  style={{
                    padding: "16px 18px",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
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
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: T.textPrimary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      {quiz.title}
                    </div>
                    {role === "ADMIN" && (
                      <IconBtn
                        onClick={(e) => meta.canDelete && deleteQuiz(quiz, e)}
                        disabled={!meta.canDelete || deletingId === quiz.id}
                        title={
                          meta.canDelete
                            ? "Delete quiz"
                            : `Cannot delete a ${meta.label.toLowerCase()} quiz`
                        }
                        danger
                      >
                        <Trash2 size={15} />
                      </IconBtn>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Badge label={meta.label} customColors={meta.colors} />
                    <VisibilityBadge visibility={quiz.visibility} />
                    <span style={{ fontSize: 12, color: T.textMuted }}>
                      {quiz._count?.quizQuestions ?? 0} Qs
                    </span>
                  </div>
                  {quiz.scheduledStartTime && (
                    <div
                      style={{
                        fontSize: 12,
                        color: T.textMuted,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <CalendarClock size={13} />
                      {formatSchedule(quiz.scheduledStartTime)}
                    </div>
                  )}
                  {quiz.createdBy && (
                    <div
                      style={{
                        fontSize: 12,
                        color: T.textMuted,
                        marginTop: "auto",
                      }}
                    >
                      by {quiz.createdBy.fullName}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!confirmQuiz}
        onClose={() => setConfirmQuiz(null)}
        onConfirm={confirmDeleteQuiz}
        title="Delete quiz"
        message={`Are you sure you want to delete "${confirmQuiz?.title}"? This action cannot be undone.`}
        confirmLabel="Delete quiz"
        loading={deletingId === confirmQuiz?.id}
      />
    </div>
  );
}

// ─── Question Bank Panel ──────────────────────────────────────────────────────

function QuestionBankPanel() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [viewQuestion, setViewQuestion] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmQuestion, setConfirmQuestion] = useState(null);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      setQuestions((await questionApi.getAll()) ?? []);
    } catch {
      /* non-fatal */
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
    setShowCreate(false);
  }

  function deleteQuestion(q, e) {
    e.stopPropagation();
    setConfirmQuestion(q);
  }

  async function confirmDeleteQuestion() {
    if (!confirmQuestion) return;
    setDeletingId(confirmQuestion.id);
    try {
      await questionApi.delete(confirmQuestion.id);
      toast("Deleted.", "success");
      setQuestions((prev) => prev.filter((x) => x.id !== confirmQuestion.id));
      setConfirmQuestion(null);
    } catch (err) {
      toast(err.message || "Failed.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = questions.filter((q) =>
    q.questionText.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
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
              marginBottom: 4,
            }}
          >
            Reusable questions
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 800,
              color: T.textPrimary,
              letterSpacing: "-0.02em",
            }}
          >
            Question Bank
          </h2>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={15} style={{ marginRight: 6 }} />
          New question
        </Button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search questions…"
        style={{ ...INPUT_BASE, fontSize: 14, marginBottom: 22 }}
      />

      {loading ? (
        <div style={{ textAlign: "center", padding: 80 }}>
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon=""
          title="No questions"
          subtitle={
            search ? "No matches." : 'Click "New question" to create one.'
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((q) => (
            <div
              key={q.id}
              onClick={() => setViewQuestion(q)}
              style={{
                padding: "18px",
                background: T.cardBg,
                border: `1.5px solid ${T.cardBorder}`,
                borderRadius: 16,
                cursor: "pointer",
                transition: "border-color 0.12s, box-shadow 0.12s",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = T.primary + "60";
                e.currentTarget.style.boxShadow = `0 4px 20px ${T.primary}18`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = T.cardBorder;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {q.imageUrl && (
                <div
                  style={{
                    borderRadius: 10,
                    overflow: "hidden",
                    border: `1px solid ${T.cardBorder}`,
                  }}
                >
                  <img
                    src={q.imageUrl}
                    alt=""
                    style={{
                      width: "100%",
                      height: 120,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    color: T.textPrimary,
                    lineHeight: 1.6,
                    flex: 1,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    wordBreak: "break-word",
                  }}
                  title={q.questionText}
                >
                  {q.questionText}
                </div>
                <IconBtn
                  onClick={(e) => deleteQuestion(q, e)}
                  disabled={deletingId === q.id}
                  title="Delete"
                  danger
                >
                  <Trash2 size={15} />
                </IconBtn>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge
                  label={typeLabel(q.questionType)}
                  customColors={T.neutral}
                />
                <span
                  style={{
                    fontSize: 12,
                    color: T.textMuted,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Clock size={12} />
                  {q.customTimer != null ? `${q.customTimer}s` : "quiz default"}
                </span>
                {q.options?.length > 0 && (
                  <span style={{ fontSize: 12, color: T.textMuted }}>
                    {q.options.filter((o) => o.isCorrect).length}/
                    {q.options.length} correct
                  </span>
                )}
              </div>
              {q.options?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {q.options.map((opt) => (
                    <span
                      key={opt.id}
                      title={opt.optionText}
                      style={{
                        fontSize: 12,
                        padding: "3px 10px",
                        borderRadius: 7,
                        background: opt.isCorrect
                          ? `${T.success.dot}20`
                          : T.pageBg,
                        color: opt.isCorrect ? T.success.text : T.textMuted,
                        border: `1px solid ${opt.isCorrect ? T.success.dot + "40" : T.cardBorder}`,
                        maxWidth: 120,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "inline-block",
                      }}
                    >
                      {opt.optionText}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New question"
        width={940}
      >
        <QuestionForm
          onSave={handleCreate}
          onCancel={() => setShowCreate(false)}
          saveLabel="Create question"
        />
      </Modal>

      <QuestionModal
        open={!!viewQuestion}
        onClose={() => setViewQuestion(null)}
        question={viewQuestion}
        onSaved={() => {
          fetchQuestions();
          setViewQuestion(null);
        }}
      />

      <ConfirmModal
        open={!!confirmQuestion}
        onClose={() => setConfirmQuestion(null)}
        onConfirm={confirmDeleteQuestion}
        title="Delete question"
        message="Are you sure you want to delete this question? This action cannot be undone."
        confirmLabel="Delete question"
        loading={deletingId === confirmQuestion?.id}
      />
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

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
      if (selectedQuiz) {
        const updated = (data ?? []).find((q) => q.id === selectedQuiz.id);
        setSelectedQuiz(updated ?? selectedQuiz);
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

  return (
    <div
      style={{
        padding: "30px 44px",
        boxSizing: "border-box",
        minHeight: "100%",
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: T.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 4,
          }}
        >
          Content
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            color: T.textPrimary,
            letterSpacing: "-0.03em",
          }}
        >
          Quiz Management
        </h1>
      </div>

      <div
        style={{
          display: "flex",
          borderBottom: `1px solid ${T.cardBorder}`,
          marginBottom: 28,
        }}
      >
        {[
          { key: "quizzes", label: "Quizzes" },
          { key: "bank", label: "Question Bank" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: `2.5px solid ${activeTab === tab.key ? T.primary : "transparent"}`,
              color: activeTab === tab.key ? T.primary : T.textMuted,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 700,
              padding: "10px 24px",
              transition: "all 0.12s",
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "quizzes" && (
        <QuizListPanel
          quizzes={quizzes}
          loading={loading}
          onSelect={setSelectedQuiz}
          onNew={() => setShowNewQuiz(true)}
          onDeleted={(id) => {
            setQuizzes((p) => p.filter((q) => q.id !== id));
            if (selectedQuiz?.id === id) setSelectedQuiz(null);
          }}
          role={role}
        />
      )}
      {activeTab === "bank" && <QuestionBankPanel />}

      <QuizFormModal
        open={showNewQuiz}
        onClose={() => setShowNewQuiz(false)}
        quiz={null}
        onSaved={fetchQuizzes}
      />
      <QuizDetailModal
        open={!!selectedQuiz}
        onClose={() => setSelectedQuiz(null)}
        quiz={selectedQuiz}
        onQuizUpdated={fetchQuizzes}
        role={role}
      />
    </div>
  );
}
