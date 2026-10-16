// Bulk upload questions modal supporting CSV and XLSX formats.
// Includes template download with meaningful names, mandatory vs optional tooltip/guidelines,
// single-correct answer enforcement, and an interactive validation preview table.

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  X,
  Clock,
  Filter,
  Check,
} from "lucide-react";
import { Modal, Button, Spinner, toast } from "../../components/ui/index.jsx";
import APP_CONFIG from "../../config/app.config.js";
import { questionApi } from "../../services/api.service.js";

const T = APP_CONFIG.theme;
const LIMITS = APP_CONFIG.quiz?.limits ?? {
  questionText: 120,
  optionText: 50,
};

// ─── Template Generation & Download ──────────────────────────────────────────

const SAMPLE_TEMPLATE_ROWS = [
  {
    "Question Text": "Which data structure uses LIFO (Last In First Out) principle?",
    "Option A": "Queue",
    "Option B": "Stack",
    "Option C": "Binary Tree",
    "Option D": "Array",
    "Correct Option": "B",
    "Timer (seconds)": 30,
    "Image URL": "",
  },
  {
    "Question Text": "What is the worst-case search complexity of Binary Search?",
    "Option A": "O(1)",
    "Option B": "O(n)",
    "Option C": "O(log n)",
    "Option D": "O(n^2)",
    "Correct Option": "C",
    "Timer (seconds)": 45,
    "Image URL": "",
  },
  {
    "Question Text": "In JavaScript, arrays are zero-indexed.",
    "Option A": "True",
    "Option B": "False",
    "Option C": "",
    "Option D": "",
    "Correct Option": "A",
    "Timer (seconds)": 20,
    "Image URL": "",
  },
  {
    "Question Text": "Which HTTP status code signifies that a resource was successfully created?",
    "Option A": "200 OK",
    "Option B": "201 Created",
    "Option C": "400 Bad Request",
    "Option D": "404 Not Found",
    "Correct Option": "B",
    "Timer (seconds)": 30,
    "Image URL": "",
  },
];

export function downloadQuestionsTemplate(format = "xlsx") {
  const worksheet = XLSX.utils.json_to_sheet(SAMPLE_TEMPLATE_ROWS, {
    header: [
      "Question Text",
      "Option A",
      "Option B",
      "Option C",
      "Option D",
      "Correct Option",
      "Timer (seconds)",
      "Image URL",
    ],
  });

  worksheet["!cols"] = [
    { wch: 48 }, // Question Text
    { wch: 20 }, // Option A
    { wch: 20 }, // Option B
    { wch: 20 }, // Option C
    { wch: 20 }, // Option D
    { wch: 16 }, // Correct Option
    { wch: 16 }, // Timer (seconds)
    { wch: 30 }, // Image URL
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Questions Template");

  if (format === "csv") {
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "bima_quiz_questions_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else {
    XLSX.writeFile(workbook, "bima_quiz_questions_template.xlsx");
  }
}

// ─── File Parser & Validator ─────────────────────────────────────────────────

function getFieldValue(rawRow, aliases) {
  for (const alias of aliases) {
    for (const key of Object.keys(rawRow)) {
      if (key.trim().toLowerCase() === alias.toLowerCase()) {
        const val = rawRow[key];
        return val != null ? String(val).trim() : "";
      }
    }
  }
  return "";
}

function parseAndValidateRow(rawRow, rowNumber) {
  const errors = [];

  const questionText = getFieldValue(rawRow, [
    "question text",
    "question",
    "questiontext",
    "question_text",
  ]);

  const optA = getFieldValue(rawRow, ["option a", "option 1", "optiona", "option1", "a"]);
  const optB = getFieldValue(rawRow, ["option b", "option 2", "optionb", "option2", "b"]);
  const optC = getFieldValue(rawRow, ["option c", "option 3", "optionc", "option3", "c"]);
  const optD = getFieldValue(rawRow, ["option d", "option 4", "optiond", "option4", "d"]);

  const correctRaw = getFieldValue(rawRow, [
    "correct option",
    "correct answer",
    "correctoption",
    "correct_option",
    "answer",
    "correct",
  ]);

  const timerRaw = getFieldValue(rawRow, [
    "timer (seconds)",
    "timer",
    "timer seconds",
    "custom timer",
    "customtimer",
    "timer_seconds",
  ]);

  const imageUrl = getFieldValue(rawRow, [
    "image url",
    "media url",
    "imageurl",
    "mediaurl",
    "image",
    "image_url",
  ]);

  // 1. Question Text validation
  if (!questionText) {
    errors.push("Question text is required");
  } else if (questionText.length > LIMITS.questionText) {
    errors.push(`Question text exceeds ${LIMITS.questionText} characters (current: ${questionText.length})`);
  }

  // 2. Options validation (Option A and B are mandatory)
  if (!optA) {
    errors.push("Option A is required");
  } else if (optA.length > LIMITS.optionText) {
    errors.push(`Option A exceeds ${LIMITS.optionText} characters`);
  }

  if (!optB) {
    errors.push("Option B is required");
  } else if (optB.length > LIMITS.optionText) {
    errors.push(`Option B exceeds ${LIMITS.optionText} characters`);
  }

  if (optC && optC.length > LIMITS.optionText) {
    errors.push(`Option C exceeds ${LIMITS.optionText} characters`);
  }

  if (optD && optD.length > LIMITS.optionText) {
    errors.push(`Option D exceeds ${LIMITS.optionText} characters`);
  }

  // 3. Correct Option validation (Single correct answer strictly enforced)
  let correctIndex = -1;
  const rawClean = correctRaw.trim().toUpperCase();

  if (!rawClean) {
    errors.push("Correct option is required (specify A, B, C, or D)");
  } else {
    // Check if multiple answers were provided (e.g. "A, B" or "A/B")
    if (
      rawClean.includes(",") ||
      rawClean.includes(";") ||
      rawClean.includes("/") ||
      rawClean.includes("&") ||
      (rawClean.length > 1 && /^[ABCD1-4]{2,}$/.test(rawClean))
    ) {
      errors.push(`Multiple correct answers detected (${correctRaw}). Currently, only single-correct questions are supported.`);
    } else {
      // Map letter or number
      if (rawClean === "A" || rawClean === "1" || rawClean === "OPTION A" || rawClean === "OPTION 1") {
        correctIndex = 0;
      } else if (rawClean === "B" || rawClean === "2" || rawClean === "OPTION B" || rawClean === "OPTION 2") {
        correctIndex = 1;
      } else if (rawClean === "C" || rawClean === "3" || rawClean === "OPTION C" || rawClean === "OPTION 3") {
        correctIndex = 2;
      } else if (rawClean === "D" || rawClean === "4" || rawClean === "OPTION D" || rawClean === "OPTION 4") {
        correctIndex = 3;
      } else {
        // Check if value matches exact option text
        const lowerRaw = correctRaw.trim().toLowerCase();
        if (optA && lowerRaw === optA.toLowerCase()) correctIndex = 0;
        else if (optB && lowerRaw === optB.toLowerCase()) correctIndex = 1;
        else if (optC && lowerRaw === optC.toLowerCase()) correctIndex = 2;
        else if (optD && lowerRaw === optD.toLowerCase()) correctIndex = 3;
      }

      if (correctIndex === -1) {
        errors.push(`Invalid correct option "${correctRaw}". Must be A, B, C, or D.`);
      } else if (correctIndex === 2 && !optC) {
        errors.push("Correct option is set to C, but Option C is empty");
      } else if (correctIndex === 3 && !optD) {
        errors.push("Correct option is set to D, but Option D is empty");
      }
    }
  }

  // 4. Timer validation (Optional, but must be > 0)
  let parsedTimer = null;
  if (timerRaw) {
    const num = parseInt(timerRaw, 10);
    if (isNaN(num) || num <= 0) {
      errors.push("Timer must be a positive number of seconds (e.g. 30)");
    } else {
      parsedTimer = num;
    }
  }

  // Build options array
  const options = [];
  if (optA) options.push({ optionText: optA, isCorrect: correctIndex === 0 });
  if (optB) options.push({ optionText: optB, isCorrect: correctIndex === 1 });
  if (optC) options.push({ optionText: optC, isCorrect: correctIndex === 2 });
  if (optD) options.push({ optionText: optD, isCorrect: correctIndex === 3 });

  return {
    rowNumber,
    isValid: errors.length === 0,
    errors,
    questionText,
    questionType: "SINGLE_CORRECT",
    options,
    optA,
    optB,
    optC,
    optD,
    correctOptionLetter:
      correctIndex >= 0 ? ["A", "B", "C", "D"][correctIndex] : (correctRaw || "-"),
    customTimer: parsedTimer,
    mediaUrl: imageUrl || null,
    rawRow,
  };
}

// ─── BulkUploadQuestionsModal Component ──────────────────────────────────────

export default function BulkUploadQuestionsModal({
  open,
  onClose,
  onSuccess,
}) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [parseError, setParseError] = useState("");
  const [filterErrorsOnly, setFilterErrorsOnly] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  if (!open) return null;

  function resetState() {
    setFile(null);
    setParsedRows([]);
    setParseError("");
    setFilterErrorsOnly(false);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    if (uploading) return;
    resetState();
    onClose();
  }

  function handleFileSelected(selectedFile) {
    if (!selectedFile) return;

    const extension = selectedFile.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(extension)) {
      setParseError("Unsupported file type. Please upload a .xlsx or .csv file.");
      return;
    }

    setFile(selectedFile);
    setParseError("");
    setParsing(true);

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target.result;
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          throw new Error("No sheet found in the uploaded workbook.");
        }
        const worksheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (!rawJson || rawJson.length === 0) {
          throw new Error("The file is empty or does not have any data rows.");
        }

        const rows = rawJson.map((r, idx) => parseAndValidateRow(r, idx + 2));
        setParsedRows(rows);
      } catch (err) {
        console.error("Bulk upload parse error:", err);
        setParseError(err.message || "Failed to parse file. Please check format.");
        setParsedRows([]);
      } finally {
        setParsing(false);
      }
    };

    reader.onerror = () => {
      setParseError("Could not read file. Please try again.");
      setParsing(false);
    };

    reader.readAsArrayBuffer(selectedFile);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer?.files?.[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  }

  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);
  const displayedRows = filterErrorsOnly ? invalidRows : parsedRows;

  async function handleImport() {
    if (validRows.length === 0) {
      toast("No valid questions to import.", "warning");
      return;
    }

    setUploading(true);
    try {
      const payload = validRows.map((r) => ({
        questionText: r.questionText,
        questionType: "SINGLE_CORRECT",
        customTimer: r.customTimer,
        mediaUrl: r.mediaUrl,
        options: r.options.map((o, idx) => ({
          optionText: o.optionText,
          isCorrect: o.isCorrect,
          orderIndex: idx + 1,
        })),
      }));

      const res = await questionApi.bulkCreate(payload);
      const createdQuestions = res?.data || [];

      toast(
        `Successfully imported ${createdQuestions.length || validRows.length} question${(createdQuestions.length || validRows.length) > 1 ? "s" : ""}!`,
        "success",
      );

      if (onSuccess) {
        onSuccess(createdQuestions);
      }
      handleClose();
    } catch (err) {
      console.error(err);
      toast(err.message || "Failed to import questions.", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Bulk Upload Questions"
      width={940}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* ── Subtitle & Download Template Bar ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            paddingBottom: 16,
            borderBottom: `1px solid ${T.cardBorder}`,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 14,
                color: T.textSecondary,
                lineHeight: 1.5,
              }}
            >
              Upload multiple questions at once using a CSV or Excel spreadsheet.
            </div>
            <div
              style={{
                fontSize: 12,
                color: T.textMuted,
                marginTop: 2,
              }}
            >
              Supported formats: <strong style={{ color: T.textPrimary }}>.xlsx</strong>, <strong style={{ color: T.textPrimary }}>.csv</strong>
            </div>
          </div>

          {/* Action buttons: Download Template (.xlsx) & (.csv) */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => downloadQuestionsTemplate("xlsx")}
              title="Download Microsoft Excel template file (bima_quiz_questions_template.xlsx)"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                background: "#0d2818",
                border: "1px solid #166534",
                color: "#86efac",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "opacity 0.15s, transform 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <FileSpreadsheet size={15} />
              Download Template (.xlsx)
            </button>

            <button
              type="button"
              onClick={() => downloadQuestionsTemplate("csv")}
              title="Download CSV template file (bima_quiz_questions_template.csv)"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                background: "#1e293b",
                border: `1px solid ${T.cardBorder}`,
                color: T.textSecondary,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "opacity 0.15s, transform 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <FileText size={15} />
              Download Template (.csv)
            </button>

            {/* Tooltip trigger button */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowGuidelines((prev) => !prev)}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                title="View column specifications & guidelines"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: showGuidelines ? `${T.primary}20` : "#1e293b",
                  border: `1px solid ${showGuidelines ? T.primary : T.cardBorder}`,
                  color: showGuidelines ? T.primary : T.textMuted,
                  cursor: "pointer",
                }}
              >
                <HelpCircle size={17} />
              </button>

              {/* Hover Tooltip popover */}
              {showTooltip && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 42,
                    width: 320,
                    padding: "12px 14px",
                    background: "#0b1329",
                    border: `1px solid ${T.cardBorder}`,
                    borderRadius: 10,
                    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                    zIndex: 9999,
                    fontSize: 12,
                    color: T.textSecondary,
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 700, color: T.textPrimary, marginBottom: 6 }}>
                    Quick Fields Reference
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: "#f87171", fontWeight: 700 }}>● Mandatory:</span>{" "}
                    Question Text, Option A, Option B, Correct Option
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>● Optional:</span>{" "}
                    Option C, Option D, Timer (seconds), Image URL
                  </div>
                  <div style={{ color: "#fbbf24", fontSize: 11 }}>
                    * Only single correct answer is allowed per question.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Guidelines & Field Reference Callout ── */}
        {showGuidelines && (
          <div
            style={{
              background: "#080f20",
              border: `1px solid ${T.cardBorder}`,
              borderRadius: 12,
              padding: "16px 20px",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: T.primary,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <HelpCircle size={15} />
                Template Specifications & Requirements
              </div>
              <button
                type="button"
                onClick={() => setShowGuidelines(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: T.textMuted,
                  cursor: "pointer",
                  padding: 4,
                }}
                title="Hide guide"
              >
                <X size={15} />
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                fontSize: 12.5,
                lineHeight: 1.6,
              }}
            >
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.06)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: 8,
                  padding: "10px 14px",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    color: "#f87171",
                    marginBottom: 6,
                  }}
                >
                  Mandatory Fields
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, color: T.textSecondary }}>
                  <li>
                    <strong style={{ color: T.textPrimary }}>Question Text:</strong> Title / question prompt (max {LIMITS.questionText} characters).
                  </li>
                  <li>
                    <strong style={{ color: T.textPrimary }}>Option A & Option B:</strong> Minimum 2 options required (max {LIMITS.optionText} characters each).
                  </li>
                  <li>
                    <strong style={{ color: T.textPrimary }}>Correct Option:</strong> Must specify which option is correct: <code style={{ color: "#86efac" }}>A</code>, <code style={{ color: "#86efac" }}>B</code>, <code style={{ color: "#86efac" }}>C</code>, or <code style={{ color: "#86efac" }}>D</code>.
                  </li>
                </ul>
              </div>

              <div
                style={{
                  background: "rgba(34, 197, 94, 0.06)",
                  border: "1px solid rgba(34, 197, 94, 0.2)",
                  borderRadius: 8,
                  padding: "10px 14px",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    color: "#4ade80",
                    marginBottom: 6,
                  }}
                >
                  Optional Fields
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, color: T.textSecondary }}>
                  <li>
                    <strong style={{ color: T.textPrimary }}>Option C & Option D:</strong> Additional choices for 3 or 4-option questions (max {LIMITS.optionText} chars each).
                  </li>
                  <li>
                    <strong style={{ color: T.textPrimary }}>Timer (seconds):</strong> Per-question time limit (e.g., 30). Blank uses quiz default timer.
                  </li>
                  <li>
                    <strong style={{ color: T.textPrimary }}>Image URL:</strong> Web image link for illustrated questions.
                  </li>
                </ul>
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                padding: "8px 12px",
                borderRadius: 6,
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                fontSize: 12,
                color: "#fde68a",
                lineHeight: 1.5,
              }}
            >
              <span>
                <strong>Single correct answer rule:</strong> Only <strong>one</strong> correct answer is allowed per question. Multi-select answers are currently not supported.
              </span>
            </div>
          </div>
        )}

        {/* ── File Drop Zone ── */}
        {!file ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragOver ? T.primary : T.cardBorder}`,
              borderRadius: 14,
              padding: "36px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: isDragOver ? `${T.primary}0a` : "#050914",
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              style={{ display: "none" }}
              onChange={(e) => handleFileSelected(e.target.files?.[0])}
            />

            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: `${T.primary}18`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px",
                color: T.primary,
              }}
            >
              <Upload size={24} />
            </div>

            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: T.textPrimary,
                marginBottom: 6,
              }}
            >
              Drag & drop your file here, or click to browse
            </div>

            <div style={{ fontSize: 13, color: T.textMuted }}>
              Supports <strong style={{ color: T.textSecondary }}>.xlsx</strong> and <strong style={{ color: T.textSecondary }}>.csv</strong> files
            </div>
          </div>
        ) : (
          /* Selected File Information Bar */
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#080f20",
              border: `1px solid ${T.cardBorder}`,
              borderRadius: 10,
              padding: "12px 18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: `${T.primary}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: T.primary,
                }}
              >
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>
                  {file.name}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted }}>
                  {(file.size / 1024).toFixed(1)} KB &bull; {parsedRows.length} question{parsedRows.length !== 1 ? "s" : ""} detected
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls,.csv"
                style={{ display: "none" }}
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  background: "#1e293b",
                  border: `1px solid ${T.cardBorder}`,
                  color: T.textSecondary,
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Change File
              </button>
              <button
                type="button"
                onClick={resetState}
                disabled={uploading}
                style={{
                  background: "transparent",
                  border: "none",
                  color: T.danger.dot,
                  padding: "6px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {/* ── Parse Error Alert ── */}
        {parseError && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 8,
              background: T.danger.bg,
              border: `1px solid ${T.danger.dot}40`,
              color: T.danger.text,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <AlertCircle size={17} style={{ flexShrink: 0 }} />
            <span>{parseError}</span>
          </div>
        )}

        {/* ── Parsing Loading ── */}
        {parsing && (
          <div style={{ textAlign: "center", padding: 30 }}>
            <Spinner size={32} />
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 10 }}>
              Parsing and validating questions...
            </div>
          </div>
        )}

        {/* ── Validation Summary & Preview Table ── */}
        {!parsing && parsedRows.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Summary Counters Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 20,
                    background: "#1e293b",
                    color: T.textSecondary,
                  }}
                >
                  Total: {parsedRows.length}
                </span>

                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 20,
                    background: "#052e16",
                    color: "#86efac",
                    border: "1px solid #166534",
                  }}
                >
                  ✓ Ready to import: {validRows.length}
                </span>

                {invalidRows.length > 0 && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: 20,
                      background: "#3b0a0a",
                      color: "#fca5a5",
                      border: "1px solid #7f1d1d",
                    }}
                  >
                    ✕ Errors: {invalidRows.length}
                  </span>
                )}
              </div>

              {invalidRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterErrorsOnly((prev) => !prev)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: filterErrorsOnly ? `${T.danger.dot}20` : "transparent",
                    border: `1px solid ${filterErrorsOnly ? T.danger.dot : T.cardBorder}`,
                    color: filterErrorsOnly ? "#fca5a5" : T.textMuted,
                    borderRadius: 6,
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Filter size={13} />
                  {filterErrorsOnly ? "Show All Rows" : `Show Only Errors (${invalidRows.length})`}
                </button>
              )}
            </div>

            {/* Scrollable Preview Table */}
            <div
              style={{
                maxHeight: 320,
                overflowY: "auto",
                border: `1px solid ${T.cardBorder}`,
                borderRadius: 10,
                background: "#050914",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12.5,
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#0a1122",
                      borderBottom: `1px solid ${T.cardBorder}`,
                      color: T.textMuted,
                      position: "sticky",
                      top: 0,
                      zIndex: 2,
                    }}
                  >
                    <th style={{ padding: "10px 12px", width: 50 }}>#</th>
                    <th style={{ padding: "10px 12px", width: 85 }}>Status</th>
                    <th style={{ padding: "10px 12px" }}>Question Text</th>
                    <th style={{ padding: "10px 12px", width: 210 }}>Options</th>
                    <th style={{ padding: "10px 12px", width: 80, textAlign: "center" }}>Correct</th>
                    <th style={{ padding: "10px 12px", width: 70, textAlign: "center" }}>Timer</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      style={{
                        borderBottom: `1px solid ${T.cardBorder}40`,
                        background: row.isValid
                          ? "transparent"
                          : "rgba(239, 68, 68, 0.05)",
                      }}
                    >
                      <td
                        style={{
                          padding: "10px 12px",
                          color: T.textMuted,
                          fontFamily: "monospace",
                        }}
                      >
                        {row.rowNumber}
                      </td>

                      <td style={{ padding: "10px 12px" }}>
                        {row.isValid ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              color: "#4ade80",
                              fontWeight: 600,
                              fontSize: 11.5,
                            }}
                          >
                            <CheckCircle2 size={13} />
                            Valid
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              color: "#f87171",
                              fontWeight: 600,
                              fontSize: 11.5,
                            }}
                          >
                            <AlertCircle size={13} />
                            Error
                          </span>
                        )}
                      </td>

                      <td style={{ padding: "10px 12px" }}>
                        <div
                          style={{
                            color: row.questionText ? T.textPrimary : "#f87171",
                            fontWeight: 500,
                          }}
                        >
                          {row.questionText || "— Missing question text —"}
                        </div>
                        {/* If invalid, print error messages below the question */}
                        {!row.isValid && row.errors.length > 0 && (
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 11,
                              color: "#fca5a5",
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                            }}
                          >
                            {row.errors.map((err, eIdx) => (
                              <span key={eIdx}>&bull; {err}</span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "10px 12px" }}>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                            fontSize: 11.5,
                          }}
                        >
                          {row.optA && (
                            <span
                              style={{
                                color:
                                  row.correctOptionLetter === "A"
                                    ? "#86efac"
                                    : T.textSecondary,
                                fontWeight:
                                  row.correctOptionLetter === "A" ? 700 : 400,
                              }}
                            >
                              <strong>A:</strong> {row.optA}
                            </span>
                          )}
                          {row.optB && (
                            <span
                              style={{
                                color:
                                  row.correctOptionLetter === "B"
                                    ? "#86efac"
                                    : T.textSecondary,
                                fontWeight:
                                  row.correctOptionLetter === "B" ? 700 : 400,
                              }}
                            >
                              <strong>B:</strong> {row.optB}
                            </span>
                          )}
                          {row.optC && (
                            <span
                              style={{
                                color:
                                  row.correctOptionLetter === "C"
                                    ? "#86efac"
                                    : T.textSecondary,
                                fontWeight:
                                  row.correctOptionLetter === "C" ? 700 : 400,
                              }}
                            >
                              <strong>C:</strong> {row.optC}
                            </span>
                          )}
                          {row.optD && (
                            <span
                              style={{
                                color:
                                  row.correctOptionLetter === "D"
                                    ? "#86efac"
                                    : T.textSecondary,
                                fontWeight:
                                  row.correctOptionLetter === "D" ? 700 : 400,
                              }}
                            >
                              <strong>D:</strong> {row.optD}
                            </span>
                          )}
                        </div>
                      </td>

                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          fontFamily: "monospace",
                        }}
                      >
                        {row.correctOptionLetter && row.correctOptionLetter !== "-" ? (
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: row.isValid ? "#052e16" : "#3b0a0a",
                              color: row.isValid ? "#86efac" : "#fca5a5",
                              border: `1px solid ${row.isValid ? "#166534" : "#7f1d1d"}`,
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            {row.correctOptionLetter}
                          </span>
                        ) : (
                          <span style={{ color: "#f87171" }}>—</span>
                        )}
                      </td>

                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          color: T.textMuted,
                          fontSize: 12,
                        }}
                      >
                        {row.customTimer ? `${row.customTimer}s` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Footer Action Buttons ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 16,
            borderTop: `1px solid ${T.cardBorder}`,
          }}
        >
          <div style={{ fontSize: 13, color: T.textMuted }}>
            {parsedRows.length > 0 && invalidRows.length > 0 && (
              <span style={{ color: "#fca5a5" }}>
                * {invalidRows.length} question{invalidRows.length > 1 ? "s have" : " has"} errors and will be skipped.
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={uploading}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              onClick={handleImport}
              disabled={uploading || validRows.length === 0}
            >
              {uploading ? (
                <>
                  <Spinner size={16} />
                  Importing...
                </>
              ) : (
                <>
                  <Upload size={15} />
                  Import {validRows.length > 0 ? `${validRows.length} Questions` : "Questions"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
