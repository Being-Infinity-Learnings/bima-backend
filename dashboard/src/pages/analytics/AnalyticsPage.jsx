// Analytics page — shows all completed quizzes with full submission data.
// Includes: quiz list, leaderboard, per-question breakdown, participant trail.
import { useState, useEffect, useCallback } from "react";
import {
  Card,
  Badge,
  Button,
  Spinner,
  Avatar,
  EmptyState,
  Modal,
} from "../../components/ui/index.jsx";
import { analyticsApi } from "../../services/api.service.js";
import APP_CONFIG from "../../config/app.config.js";
import {
  BarChart2,
  Users,
  HelpCircle,
  Star,
  ClipboardList,
  Flag,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Trophy,
  CheckCircle,
  XCircle,
  Minus,
  Clock,
  Search,
  AlertTriangle,
  BookOpen,
  RefreshCw,
} from "lucide-react";

const T = APP_CONFIG.theme;

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function fmtMs(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtDuration(ms) {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m === 0) return `${rem}s`;
  return `${m}m ${rem}s`;
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div
      style={{
        background: T.cardBg,
        border: `1px solid ${T.cardBorder}`,
        borderRadius: 12,
        padding: "14px 16px",
        borderLeft: accent ? `3px solid ${accent}` : undefined,
        minWidth: 130,
        flex: "1 1 130px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 4,
        }}
      >
        <Icon size={14} color={accent || T.textMuted} strokeWidth={2} />
        <span
          style={{
            fontSize: 11,
            color: T.textMuted,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: typeof value === "string" && value.length > 8 ? 15 : 20,
          fontWeight: 800,
          color: T.textPrimary,
          lineHeight: 1.25,
          letterSpacing: "-0.02em",
          whiteSpace: "normal",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11,
            color: T.textMuted,
            opacity: 0.7,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Progress Bar ───────────────────────────────────────────────────────────
function ProgressBar({ pct, color = T.primary, height = 8 }) {
  return (
    <div
      style={{
        background: "#1e293b",
        borderRadius: 99,
        overflow: "hidden",
        height,
        width: "100%",
      }}
    >
      <div
        style={{
          width: `${Math.min(100, pct)}%`,
          height: "100%",
          background: color,
          borderRadius: 99,
          transition: "width 0.4s ease",
        }}
      />
    </div>
  );
}

// ── Quiz List Card ─────────────────────────────────────────────────────────
function QuizListCard({ quiz, onSelect }) {
  return (
    <div
      onClick={() => onSelect(quiz.id)}
      style={{
        background: T.cardBg,
        border: `1px solid ${T.cardBorder}`,
        borderRadius: 16,
        padding: "20px 24px",
        cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s",
        display: "flex",
        gap: 20,
        alignItems: "center",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = T.primary;
        e.currentTarget.style.boxShadow = `0 0 0 1px ${T.primary}40`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = T.cardBorder;
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Cover or placeholder */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          flexShrink: 0,
          overflow: "hidden",
          background: `${T.primary}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {quiz.coverImageUrl ? (
          <img
            src={quiz.coverImageUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <BookOpen size={22} color={T.primary} strokeWidth={1.8} />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: T.textPrimary,
            marginBottom: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {quiz.title}
        </div>
        {quiz.description && (
          <div
            style={{
              fontSize: 13,
              color: T.textMuted,
              marginBottom: 10,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {quiz.description}
          </div>
        )}
        <div
          style={{
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
            fontSize: 12,
            color: T.textSecondary,
            alignItems: "center",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Flag size={12} color={T.textMuted} />
            {fmtDate(quiz.completedAt)}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Users size={12} color={T.textMuted} />
            {quiz.participantCount} participants
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <HelpCircle size={12} color={T.textMuted} />
            {quiz.totalQuestions} questions
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Star size={12} color={T.textMuted} />
            avg {quiz.avgScore}
          </span>
        </div>
      </div>

      {/* Arrow */}
      <ChevronRight size={18} color={T.textMuted} style={{ flexShrink: 0 }} />
    </div>
  );
}

// ── Rank Display ───────────────────────────────────────────────────────────
function RankBadge({ rank }) {
  const colors = {
    1: { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
    2: { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" },
    3: { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
  };
  const c = colors[rank];
  if (c) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: 8,
          background: c.bg,
          border: `1px solid ${c.border}`,
          fontWeight: 800,
          fontSize: 13,
          color: c.text,
        }}
      >
        {rank}
      </span>
    );
  }
  return (
    <span style={{ color: T.textMuted, fontSize: 13, fontWeight: 600 }}>
      #{rank}
    </span>
  );
}

// ── Leaderboard Table (merged with participant trail access) ──────────────
function LeaderboardTable({ entries, questions }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const filtered = entries.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      e.fullName?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.collegeName?.toLowerCase().includes(q) ||
      e.rollNumber?.toLowerCase().includes(q)
    );
  });

  return (
    <>
      {/* Search */}
      <div
        style={{
          marginBottom: 16,
          marginLeft: 16,
          position: "relative",
          maxWidth: 320,
        }}
      >
        <Search
          size={14}
          color={T.textMuted}
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
          }}
        />
        <input
          type="text"
          placeholder="Search participants…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: T.cardBg,
            border: `1px solid ${T.cardBorder}`,
            borderRadius: 10,
            color: T.textPrimary,
            fontSize: 13,
            padding: "9px 14px 9px 34px",
            width: "100%",
            fontFamily: "inherit",
            outline: "none",
            boxSizing: "border-box",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.target.style.borderColor = T.primary)}
          onBlur={(e) => (e.target.style.borderColor = T.cardBorder)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState subtitle={`No participants match "${search}"`} />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr>
                {[
                  "Rank",
                  "Participant",
                  "College / Roll",
                  "Score",
                  "Correct",
                  "Avg Time",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      color: T.textMuted,
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      borderBottom: `1px solid ${T.cardBorder}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.userId}
                  style={{
                    borderBottom: `1px solid ${T.cardBorder}30`,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(ev) =>
                    (ev.currentTarget.style.background = `${T.primary}06`)
                  }
                  onMouseLeave={(ev) =>
                    (ev.currentTarget.style.background = "transparent")
                  }
                >
                  <td style={{ padding: "14px 16px" }}>
                    <RankBadge rank={e.rank} />
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <Avatar name={e.fullName} size={32} />
                      <div>
                        <div
                          style={{
                            color: T.textPrimary,
                            fontWeight: 600,
                            fontSize: 14,
                          }}
                        >
                          {e.fullName}
                        </div>
                        <div
                          style={{
                            color: T.textMuted,
                            fontSize: 11,
                            marginTop: 1,
                          }}
                        >
                          {e.email || "—"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", color: T.textSecondary }}>
                    <div style={{ fontSize: 13 }}>{e.collegeName || "—"}</div>
                    {e.rollNumber && (
                      <div
                        style={{
                          fontSize: 11,
                          color: T.textMuted,
                          marginTop: 2,
                        }}
                      >
                        {e.rollNumber}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: 17,
                        color: e.rank === 1 ? T.primary : T.textPrimary,
                      }}
                    >
                      {e.totalScore}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ color: T.success.text, fontWeight: 600 }}>
                      {e.correctCount}
                    </span>
                    <span style={{ color: T.textMuted }}>
                      /{e.answeredCount}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px", color: T.textSecondary }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <Clock size={12} color={T.textMuted} />
                      {fmtMs(
                        e.answeredCount > 0
                          ? Math.round(e.totalElapsedMs / e.answeredCount)
                          : 0,
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelected(e)}
                    >
                      View trail
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ParticipantTrailModal
        open={!!selected}
        onClose={() => setSelected(null)}
        participant={selected}
        questions={questions}
      />
    </>
  );
}

// ── Question Breakdown ─────────────────────────────────────────────────────
function QuestionBreakdown({ questions }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {questions.map((q) => {
        const isOpen = expanded === q.questionId;
        const accuracyColor =
          q.accuracyPct >= 70
            ? T.success.dot
            : q.accuracyPct >= 40
              ? T.warning.dot
              : T.danger.dot;
        const accuracyText =
          q.accuracyPct >= 70
            ? T.success.text
            : q.accuracyPct >= 40
              ? T.warning.text
              : T.danger.text;

        return (
          <div
            key={q.questionId}
            style={{
              background: T.cardBg,
              border: `1px solid ${T.cardBorder}`,
              borderRadius: 14,
              overflow: "hidden",
              transition: "border-color 0.15s",
              borderColor: isOpen ? T.primary + "60" : T.cardBorder,
            }}
          >
            {/* Header row */}
            <div
              onClick={() => setExpanded(isOpen ? null : q.questionId)}
              style={{
                padding: "16px 20px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              {/* Q number */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: T.primary + "18",
                  color: T.primary,
                  fontWeight: 800,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  letterSpacing: "0.02em",
                }}
              >
                Q{q.orderIndex + 1}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: T.textPrimary,
                    marginBottom: 6,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {q.questionText}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 18,
                    fontSize: 12,
                    color: T.textMuted,
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <CheckCircle size={11} color={T.success.dot} />
                    <span style={{ color: T.success.text }}>
                      {q.correctCount}
                    </span>{" "}
                    correct
                  </span>
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <XCircle size={11} color={T.danger.dot} />
                    <span style={{ color: T.danger.text }}>
                      {q.incorrectCount}
                    </span>{" "}
                    incorrect
                  </span>
                  <span>{q.totalAnswered} answered</span>
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <Clock size={11} color={T.textMuted} />
                    avg {fmtMs(q.avgElapsedMs)}
                  </span>
                </div>
              </div>

              {/* Accuracy */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 2,
                  flexShrink: 0,
                  marginRight: 8,
                }}
              >
                <span
                  style={{ fontWeight: 800, fontSize: 18, color: accuracyText }}
                >
                  {q.accuracyPct}%
                </span>
                <span style={{ fontSize: 11, color: T.textMuted }}>
                  accuracy
                </span>
              </div>

              <ChevronDown
                size={16}
                color={T.textMuted}
                style={{
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                  flexShrink: 0,
                }}
              />
            </div>

            {/* Accuracy bar (always visible) */}
            <div style={{ padding: "0 20px 14px" }}>
              <ProgressBar
                pct={q.accuracyPct}
                color={accuracyColor}
                height={4}
              />
            </div>

            {/* Expanded: option breakdown */}
            {isOpen && (
              <div
                style={{
                  padding: "20px",
                  borderTop: `1px solid ${T.cardBorder}`,
                  background: "#0f172a50",
                }}
              >
                {q.mediaUrl && (
                  <img
                    src={q.mediaUrl}
                    alt="question media"
                    style={{
                      maxWidth: "100%",
                      borderRadius: 10,
                      marginBottom: 20,
                    }}
                  />
                )}
                <div
                  style={{
                    fontSize: 11,
                    color: T.textMuted,
                    marginBottom: 14,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 600,
                  }}
                >
                  Answer Distribution
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {q.options.map((opt) => (
                    <div key={opt.id}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 6,
                          fontSize: 13,
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            color: opt.isCorrect
                              ? T.success.text
                              : T.textSecondary,
                            fontWeight: opt.isCorrect ? 700 : 400,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          {opt.isCorrect ? (
                            <CheckCircle size={14} color={T.success.dot} />
                          ) : (
                            <div style={{ width: 14 }} />
                          )}
                          {opt.optionText}
                        </span>
                        <span
                          style={{
                            color: T.textMuted,
                            flexShrink: 0,
                            marginLeft: 16,
                          }}
                        >
                          {opt.selectedCount}{" "}
                          <span style={{ opacity: 0.6 }}>
                            ({opt.selectedPct}%)
                          </span>
                        </span>
                      </div>
                      <ProgressBar
                        pct={opt.selectedPct}
                        color={opt.isCorrect ? T.success.dot : "#334155"}
                        height={7}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Participant Trail Modal ────────────────────────────────────────────────
function ParticipantTrailModal({ open, onClose, participant, questions }) {
  if (!participant) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${participant.fullName} — Answer Trail`}
      width={700}
    >
      {/* Summary strip */}
      <div
        style={{
          display: "flex",
          background: "#0f172a",
          borderRadius: 12,
          padding: "14px 20px",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 24,
        }}
      >
        {[
          { label: "Rank", value: `#${participant.rank}`, color: T.primary },
          {
            label: "Score",
            value: participant.totalScore,
            color: T.textPrimary,
          },
          {
            label: "Correct",
            value: `${participant.correctCount}/${participant.answeredCount}`,
            color: T.success.text,
          },
          {
            label: "Total time",
            value: fmtDuration(participant.totalElapsedMs),
            color: T.textPrimary,
          },
        ].map((item) => (
          <div key={item.label}>
            <div
              style={{
                fontSize: 11,
                color: T.textMuted,
                marginBottom: 3,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              {item.label}
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: item.color }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
        >
          <thead>
            <tr>
              {["Q#", "Question", "Selected", "Result", "Score", "Time"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      color: T.textMuted,
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      borderBottom: `1px solid ${T.cardBorder}`,
                      textAlign: "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {participant.trail.map((t, i) => {
              const q = questions.find((x) => x.questionId === t.questionId);
              const selectedOptions =
                q?.options.filter((o) => t.selectedOptionIds.includes(o.id)) ??
                [];

              return (
                <tr
                  key={t.questionId}
                  style={{
                    borderBottom: `1px solid ${T.cardBorder}20`,
                    background: !t.answered
                      ? "transparent"
                      : t.correct
                        ? `${T.success.dot}08`
                        : `${T.danger.dot}08`,
                  }}
                >
                  <td
                    style={{
                      padding: "12px 14px",
                      color: T.primary,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Q{i + 1}
                  </td>
                  <td
                    style={{
                      padding: "12px 14px",
                      color: T.textSecondary,
                      maxWidth: 200,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={q?.questionText}
                  >
                    {q?.questionText ?? "—"}
                  </td>
                  <td
                    style={{
                      padding: "12px 14px",
                      color: T.textSecondary,
                      maxWidth: 160,
                    }}
                  >
                    {!t.answered ? (
                      <span style={{ color: T.textMuted, fontStyle: "italic" }}>
                        not answered
                      </span>
                    ) : selectedOptions.length === 0 ? (
                      <span style={{ color: T.textMuted }}>—</span>
                    ) : (
                      selectedOptions.map((o) => o.optionText).join(", ")
                    )}
                  </td>
                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                    {!t.answered ? (
                      <span
                        style={{
                          color: T.textMuted,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Minus size={13} /> —
                      </span>
                    ) : t.correct ? (
                      <span
                        style={{
                          color: T.success.text,
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <CheckCircle size={13} color={T.success.dot} /> Correct
                      </span>
                    ) : (
                      <span
                        style={{
                          color: T.danger.text,
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <XCircle size={13} color={T.danger.dot} /> Wrong
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "12px 14px",
                      fontWeight: 700,
                      color: T.textPrimary,
                    }}
                  >
                    {t.score}
                  </td>
                  <td
                    style={{
                      padding: "12px 14px",
                      color: T.textMuted,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fmtMs(t.elapsedMs)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

// ── Section Header ─────────────────────────────────────────────────────────
function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 20, paddingLeft: 16, paddingTop: 16 }}>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: T.textPrimary,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Tab Bar ────────────────────────────────────────────────────────────────
const TAB_ICONS = {
  leaderboard: Trophy,
  questions: HelpCircle,
  participants: Users,
};

function TabBar({ tabs, active, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        background: "#0f172a",
        borderRadius: 12,
        padding: 4,
        marginBottom: 28,
      }}
    >
      {tabs.map((t) => {
        const Icon = TAB_ICONS[t.id];
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 9,
              border: "none",
              background: isActive ? T.cardBg : "transparent",
              color: isActive ? T.textPrimary : T.textMuted,
              fontWeight: isActive ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
            }}
          >
            {Icon && (
              <Icon
                size={14}
                color={isActive ? T.primary : T.textMuted}
                strokeWidth={isActive ? 2.5 : 2}
              />
            )}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Quiz Detail View ───────────────────────────────────────────────────────
function QuizDetailView({ quizId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("leaderboard");

  useEffect(() => {
    setLoading(true);
    setError(null);
    analyticsApi
      .getQuizAnalytics(quizId)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load analytics"))
      .finally(() => setLoading(false));
  }, [quizId]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 300,
          gap: 12,
          color: T.textMuted,
        }}
      >
        <Spinner size={22} />
        Loading analytics…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <EmptyState
          icon={<AlertTriangle size={32} color={T.danger.dot} />}
          title="Failed to load"
          subtitle={error}
        />
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={14} style={{ marginRight: 6 }} />
            Back
          </Button>
        </div>
      </div>
    );
  }

  const { quiz, summary, questions, participantTrail } = data;

  const tabs = [
    { id: "leaderboard", label: `Leaderboard (${participantTrail.length})` },
    { id: "questions", label: `Questions (${questions.length})` },
  ];

  return (
    <div>
      {/* Top nav */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "transparent",
            border: `1px solid ${T.cardBorder}`,
            borderRadius: 10,
            color: T.textSecondary,
            padding: "8px 16px",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = T.primary;
            e.currentTarget.style.color = T.textPrimary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = T.cardBorder;
            e.currentTarget.style.color = T.textSecondary;
          }}
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div style={{ width: 1, height: 32, background: T.cardBorder }} />
        <div>
          <div
            style={{
              fontSize: 11,
              color: T.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 2,
            }}
          >
            Analytics
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 800,
              color: T.textPrimary,
              letterSpacing: "-0.03em",
            }}
          >
            {quiz.title}
          </h2>
        </div>
      </div>

      {/* Summary stats */}
      <div
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          marginBottom: 36,
        }}
      >
        <StatCard
          icon={Users}
          label="Participants"
          value={summary.participantCount}
          accent={T.primary}
        />
        <StatCard
          icon={HelpCircle}
          label="Questions"
          value={summary.totalQuestions}
          accent="#7c3aed"
        />
        <StatCard
          icon={Star}
          label="Avg Score"
          value={summary.avgScore}
          sub={`Top: ${summary.topScore}`}
          accent={T.warning.dot}
        />
        <StatCard
          icon={ClipboardList}
          label="Submissions"
          value={summary.totalSubmissions}
          accent={T.info.dot}
        />
        <StatCard
          icon={Flag}
          label="Completed"
          value={fmtDate(quiz.completedAt)}
          accent={T.success.dot}
        />
      </div>

      {/* Tabs */}
      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      {/* Tab content */}
      {tab === "leaderboard" && (
        <Card>
          <SectionHeader
            title="Leaderboard"
            sub="Ranked by total score, then fastest total response time. Search or view a participant's full answer trail."
          />
          {participantTrail.length === 0 ? (
            <EmptyState subtitle="No submissions recorded for this quiz" />
          ) : (
            <LeaderboardTable
              entries={participantTrail}
              questions={questions}
            />
          )}
        </Card>
      )}

      {tab === "questions" && (
        <Card>
          <SectionHeader
            title="Question Breakdown"
            sub="Click a question to see the answer distribution"
          />
          {questions.length === 0 ? (
            <EmptyState subtitle="No questions found" />
          ) : (
            <QuestionBreakdown questions={questions} />
          )}
        </Card>
      )}
    </div>
  );
}

// ── Main Analytics Page ────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedQuizId, setSelectedQuizId] = useState(null);
  const [search, setSearch] = useState("");

  const loadQuizzes = useCallback(() => {
    setLoading(true);
    setError(null);
    analyticsApi
      .getCompletedQuizzes()
      .then(setQuizzes)
      .catch((e) => setError(e.message || "Failed to load quizzes"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  if (selectedQuizId) {
    return (
      <div style={{ padding: "40px 48px", maxWidth: 1100 }}>
        <QuizDetailView
          quizId={selectedQuizId}
          onBack={() => setSelectedQuizId(null)}
        />
      </div>
    );
  }

  const filtered = quizzes.filter((q) =>
    q.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={{ padding: "40px 48px", maxWidth: 1100 }}>
      {/* Page header */}
      <div style={{ marginBottom: 36 }}>
        <div
          style={{
            fontSize: 11,
            color: T.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: 6,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <BarChart2 size={12} color={T.textMuted} />
          Performance & Reporting
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: T.textPrimary,
            margin: 0,
            letterSpacing: "-0.04em",
          }}
        >
          Analytics
        </h1>
      </div>

      {/* Summary bar */}
      {!loading && !error && (
        <div
          style={{
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 36,
          }}
        >
          <StatCard
            icon={BarChart2}
            label="Completed Quizzes"
            value={quizzes.length}
            accent={T.primary}
          />
          <StatCard
            icon={Users}
            label="Total Participants"
            value={quizzes.reduce((s, q) => s + q.participantCount, 0)}
            accent="#7c3aed"
          />
          <StatCard
            icon={ClipboardList}
            label="Total Submissions"
            value={quizzes.reduce((s, q) => s + q.totalSubmissions, 0)}
            accent={T.info.dot}
          />
        </div>
      )}

      {/* Search */}
      {!loading && !error && quizzes.length > 0 && (
        <div style={{ marginBottom: 24, position: "relative", maxWidth: 360 }}>
          <Search
            size={14}
            color={T.textMuted}
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search quizzes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: T.cardBg,
              border: `1px solid ${T.cardBorder}`,
              borderRadius: 12,
              color: T.textPrimary,
              fontSize: 14,
              padding: "11px 16px 11px 38px",
              width: "100%",
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = T.primary)}
            onBlur={(e) => (e.target.style.borderColor = T.cardBorder)}
          />
        </div>
      )}

      {/* States */}
      {loading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: T.textMuted,
            padding: "60px 0",
          }}
        >
          <Spinner size={22} />
          Loading completed quizzes…
        </div>
      )}

      {error && (
        <Card>
          <EmptyState
            icon={<AlertTriangle size={32} color={T.danger.dot} />}
            title="Error loading quizzes"
            subtitle={error}
          />
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <Button onClick={loadQuizzes}>
              <RefreshCw size={14} style={{ marginRight: 6 }} />
              Retry
            </Button>
          </div>
        </Card>
      )}

      {!loading && !error && quizzes.length === 0 && (
        <Card>
          <EmptyState
            icon={<BarChart2 size={32} color={T.textMuted} />}
            title="No completed quizzes yet"
            subtitle="Analytics will appear here once quizzes have been completed."
          />
        </Card>
      )}

      {!loading && !error && filtered.length === 0 && quizzes.length > 0 && (
        <Card>
          <EmptyState
            icon={<Search size={32} color={T.textMuted} />}
            title="No results"
            subtitle={`No quizzes match "${search}"`}
          />
        </Card>
      )}

      {/* Quiz list */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((q) => (
            <QuizListCard key={q.id} quiz={q} onSelect={setSelectedQuizId} />
          ))}
        </div>
      )}
    </div>
  );
}
