// Modal for adding or editing a store reward item.
//
// Matches the design reference:
// - Image dropzone with drag & drop and preview
// - Name and description inputs
// - Coin cost and starting stock in two columns
// - Segmented Status toggle (Active / Inactive)
// - Save and Cancel actions

import { useState, useEffect, useRef } from "react";
import { X, Image as ImageIcon, Trash2 } from "lucide-react";
import APP_CONFIG from "../../config/app.config.js";

const T = APP_CONFIG.theme;

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export default function StoreItemModal({
  open,
  onClose,
  onSave,
  initialData = null,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coinCost, setCoinCost] = useState("");
  const [stock, setStock] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [imagePreview, setImagePreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef(null);

  const isEditing = Boolean(initialData && initialData.id);

  // Initialize form state when opened
  useEffect(() => {
    if (open) {
      if (initialData) {
        setName(initialData.name || "");
        setDescription(initialData.description || "");
        setCoinCost(initialData.coinCost ?? "");
        setStock(initialData.stock ?? "");
        setStatus(initialData.status || "ACTIVE");
        setImagePreview(initialData.imageUrl || null);
      } else {
        setName("");
        setDescription("");
        setCoinCost("");
        setStock("");
        setStatus("ACTIVE");
        setImagePreview(null);
      }
      setError("");
      setSubmitting(false);
    }
  }, [open, initialData]);

  if (!open) return null;

  function handleFileSelect(file) {
    if (!file) return;

    if (!ALLOWED_MIME.includes(file.type)) {
      setError("Please select a PNG, JPG, or WebP image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Image size exceeds 5MB limit.");
      return;
    }

    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Item name is required.");
      return;
    }

    const costNum = Number(coinCost);
    if (Number.isNaN(costNum) || costNum < 0) {
      setError("Please enter a valid coin cost (0 or higher).");
      return;
    }

    const stockNum = Number(stock);
    if (Number.isNaN(stockNum) || stockNum < 0) {
      setError("Please enter a valid stock number (0 or higher).");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        imageUrl: imagePreview || null,
        coinCost: costNum,
        stock: stockNum,
        status,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save store item.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 20,
          padding: 28,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
          position: "relative",
          animation: "fadeIn 0.15s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "#f8fafc",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {isEditing ? "Edit Store Item" : "Add Store Item"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: submitting ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#f8fafc";
              e.currentTarget.style.background = "#334155";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#94a3b8";
              e.currentTarget.style.background = "#1e293b";
            }}
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fca5a5",
              fontSize: 13,
              padding: "10px 14px",
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Item Image Upload Zone */}
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#cbd5e1",
                marginBottom: 8,
              }}
            >
              Item image
            </label>

            {imagePreview ? (
              <div
                style={{
                  position: "relative",
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid #334155",
                  height: 150,
                  background: "#090d16",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={imagePreview}
                  alt="Item Preview"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0, 0, 0, 0.5)",
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
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: "#1e293b",
                      color: "#f8fafc",
                      border: "1px solid #475569",
                      padding: "6px 14px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => setImagePreview(null)}
                    style={{
                      background: "rgba(239, 68, 68, 0.8)",
                      color: "#ffffff",
                      border: "none",
                      padding: "6px 14px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Trash2 size={13} />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `1.5px dashed ${dragOver ? "#B5E82C" : "#334155"}`,
                  borderRadius: 12,
                  background: dragOver ? "rgba(181, 232, 44, 0.05)" : "#090d16",
                  padding: "26px 16px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: 8,
                  }}
                >
                  <ImageIcon size={30} color="#64748b" strokeWidth={1.5} />
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#cbd5e1",
                    fontWeight: 500,
                    marginBottom: 4,
                  }}
                >
                  Click to upload, or drag an image here
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  PNG or JPG, up to 5MB
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />
          </div>

          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#cbd5e1",
                marginBottom: 6,
              }}
            >
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wireless Earbuds"
              required
              style={{
                width: "100%",
                background: "#090d16",
                border: "1px solid #1e293b",
                borderRadius: 10,
                padding: "11px 14px",
                color: "#f8fafc",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#B5E82C")}
              onBlur={(e) => (e.target.style.borderColor = "#1e293b")}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#cbd5e1",
                marginBottom: 6,
              }}
            >
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description shown to students"
              rows={3}
              style={{
                width: "100%",
                background: "#090d16",
                border: "1px solid #1e293b",
                borderRadius: 10,
                padding: "11px 14px",
                color: "#f8fafc",
                fontSize: 14,
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
                resize: "vertical",
                minHeight: 74,
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#B5E82C")}
              onBlur={(e) => (e.target.style.borderColor = "#1e293b")}
            />
          </div>

          {/* Coin cost & Starting stock */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              marginBottom: 16,
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#cbd5e1",
                  marginBottom: 6,
                }}
              >
                Coin cost
              </label>
              <input
                type="number"
                min="0"
                value={coinCost}
                onChange={(e) => setCoinCost(e.target.value)}
                placeholder="250"
                required
                style={{
                  width: "100%",
                  background: "#090d16",
                  border: "1px solid #1e293b",
                  borderRadius: 10,
                  padding: "11px 14px",
                  color: "#f8fafc",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#B5E82C")}
                onBlur={(e) => (e.target.style.borderColor = "#1e293b")}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#cbd5e1",
                  marginBottom: 6,
                }}
              >
                {isEditing ? "Stock" : "Starting stock"}
              </label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="10"
                required
                style={{
                  width: "100%",
                  background: "#090d16",
                  border: "1px solid #1e293b",
                  borderRadius: 10,
                  padding: "11px 14px",
                  color: "#f8fafc",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#B5E82C")}
                onBlur={(e) => (e.target.style.borderColor = "#1e293b")}
              />
            </div>
          </div>

          {/* Status Segmented Toggle */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#cbd5e1",
                marginBottom: 6,
              }}
            >
              Status
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                background: "#090d16",
                padding: 4,
                borderRadius: 10,
                border: "1px solid #1e293b",
              }}
            >
              <button
                type="button"
                onClick={() => setStatus("ACTIVE")}
                style={{
                  padding: "9px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  border:
                    status === "ACTIVE"
                      ? "1px solid #2e571c"
                      : "1px solid transparent",
                  background: status === "ACTIVE" ? "#1e3314" : "transparent",
                  color: status === "ACTIVE" ? "#B5E82C" : "#94a3b8",
                }}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatus("INACTIVE")}
                style={{
                  padding: "9px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  border:
                    status === "INACTIVE"
                      ? "1px solid #334155"
                      : "1px solid transparent",
                  background: status === "INACTIVE" ? "#1e293b" : "transparent",
                  color: status === "INACTIVE" ? "#f8fafc" : "#94a3b8",
                }}
              >
                Inactive
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.3fr",
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: "12px 18px",
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 10,
                color: "#cbd5e1",
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) =>
                !submitting && (e.currentTarget.style.background = "#334155")
              }
              onMouseLeave={(e) =>
                !submitting && (e.currentTarget.style.background = "#1e293b")
              }
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "12px 18px",
                background: submitting ? "#8ea834" : "#B5E82C",
                border: "none",
                borderRadius: 10,
                color: "#0a0f1d",
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer",
                transition: "all 0.15s",
                boxShadow: "0 4px 12px rgba(181, 232, 44, 0.25)",
              }}
              onMouseEnter={(e) => {
                if (!submitting) {
                  e.currentTarget.style.background = "#c6f83b";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!submitting) {
                  e.currentTarget.style.background = "#B5E82C";
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
            >
              {submitting ? "Saving..." : "Save Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
