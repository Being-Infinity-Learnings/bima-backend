// Store items management page for administrators.
//
// Matches the visual reference:
// - Header with branding breadcrumb, title, item count, and "+ Add Item" button
// - 4 Top Metric Cards (Total Items, Active Items, Out of Stock, Total Redemptions)
// - Visual store items grid with custom gradient banners, prices in coins, stock levels, and status badges
// - Add & Edit item modal with full support for image upload, coin pricing, and stock management

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Pencil, Package, RefreshCw } from "lucide-react";
import { storeApi } from "../../services/store.service.js";
import StoreItemModal from "./StoreItemModal.jsx";
import { Spinner, EmptyState, toast } from "../../components/ui/index.jsx";
import APP_CONFIG from "../../config/app.config.js";

const T = APP_CONFIG.theme;

// Metric Card with colored ring indicator and top accent border
function StoreMetricCard({ label, value, accentColor, ringColor, loading = false }) {
  return (
    <div
      style={{
        background: "#111827",
        border: "1px solid #1f2937",
        borderTop: `3px solid ${accentColor}`,
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 104,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Ring indicator */}
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            border: `2.5px solid ${ringColor}`,
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        {loading ? (
          <Spinner size={22} color={accentColor} />
        ) : (
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: "#f8fafc",
              lineHeight: 1,
              letterSpacing: "-0.03em",
            }}
          >
            {value}
          </div>
        )}

        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#94a3b8",
            marginTop: 8,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

// Fallback gradients for store items without custom images
const DEFAULT_GRADIENTS = [
  "linear-gradient(135deg, #4ade80 0%, #2dd4bf 100%)",
  "linear-gradient(135deg, #818cf8 0%, #60a5fa 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
  "linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)",
  "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)",
  "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
];

export default function StorePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Load store items directly from backend API
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await storeApi.getItems();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      toast(err?.message || "Failed to load store items", "error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem("bima_store_items_dummy_v1");
    } catch {
      // ignore
    }
    loadItems();
  }, [loadItems]);

  // Compute summary metrics dynamically from live items
  const metrics = useMemo(() => {
    const total = items.length;
    const active = items.filter(
      (item) => item.status === "ACTIVE" && Number(item.stock) > 0
    ).length;
    const outOfStock = items.filter(
      (item) => Number(item.stock) <= 0
    ).length;
    const redemptions = items.reduce(
      (acc, it) => acc + (it._count?.redemptions ?? it.redemptions?.length ?? 0),
      0
    );

    return { total, active, outOfStock, redemptions };
  }, [items]);

  // Handle create or update item
  async function handleSaveItem(itemData) {
    if (editingItem && editingItem.id) {
      // Update
      const updated = await storeApi.updateItem(editingItem.id, itemData);
      setItems((prev) =>
        prev.map((it) => (it.id === editingItem.id ? (updated || it) : it))
      );
      toast("Reward item updated successfully!", "success");
    } else {
      // Create
      const created = await storeApi.createItem(itemData);
      setItems((prev) => [created, ...prev]);
      toast("Reward item added successfully!", "success");
    }
    // Sync with backend state
    loadItems();
  }

  function openCreateModal() {
    setEditingItem(null);
    setModalOpen(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setModalOpen(true);
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1280, margin: "0 auto" }}>
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 28,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          {/* Breadcrumb / Org tag */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 4,
            }}
          >
            {APP_CONFIG.org || "BIMA"} • {APP_CONFIG.name ? APP_CONFIG.name.toUpperCase() : "BEING INFINITY"}
          </div>

          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#f8fafc",
              margin: 0,
              letterSpacing: "-0.03em",
            }}
          >
            Store Items
          </h1>

          <div
            style={{
              fontSize: 13,
              color: "#94a3b8",
              marginTop: 4,
            }}
          >
            Manage redeemable rewards • {items.length} {items.length === 1 ? "item" : "items"}
          </div>
        </div>

        {/* Action Button */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            onClick={openCreateModal}
            style={{
              background: "#B5E82C",
              color: "#0a0f1d",
              border: "none",
              borderRadius: 10,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 14px rgba(181, 232, 44, 0.25)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#c6f83b";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#B5E82C";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <StoreMetricCard
          label="Total Items"
          value={metrics.total}
          accentColor="#84cc16"
          ringColor="#84cc16"
          loading={loading}
        />
        <StoreMetricCard
          label="Active Items"
          value={metrics.active}
          accentColor="#f97316"
          ringColor="#f97316"
          loading={loading}
        />
        <StoreMetricCard
          label="Out of Stock"
          value={metrics.outOfStock}
          accentColor="#06b6d4"
          ringColor="#06b6d4"
          loading={loading}
        />
        <StoreMetricCard
          label="Total Redemptions"
          value={metrics.redemptions}
          accentColor="#ec4899"
          ringColor="#ec4899"
          loading={loading}
        />
      </div>

      {/* Main Items Content */}
      {loading ? (
        <div
          style={{
            minHeight: 280,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <Spinner size={32} />
          <div style={{ color: "#94a3b8", fontSize: 13 }}>Loading store items...</div>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="🛍️"
          title="No store items found"
          subtitle="Get started by adding your first reward item for students to redeem."
        >
          <button
            type="button"
            onClick={openCreateModal}
            style={{
              marginTop: 16,
              background: "#B5E82C",
              color: "#0a0f1d",
              border: "none",
              borderRadius: 10,
              padding: "10px 22px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Add First Item
          </button>
        </EmptyState>
      ) : (
        /* Items Grid */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
            gap: 22,
          }}
        >
          {items.map((item, index) => {
            const isOutOfStock = Number(item.stock) <= 0;
            const isActive = item.status === "ACTIVE" && !isOutOfStock;
            const fallbackGradient =
              item.gradient || DEFAULT_GRADIENTS[index % DEFAULT_GRADIENTS.length];

            return (
              <div
                key={item.id}
                onClick={() => openEditModal(item)}
                style={{
                  background: "#111827",
                  border: "1px solid #1f2937",
                  borderRadius: 18,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  position: "relative",
                  opacity: isOutOfStock ? 0.78 : 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.borderColor = "#374151";
                  e.currentTarget.style.boxShadow =
                    "0 12px 24px -8px rgba(0, 0, 0, 0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#1f2937";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {/* Media Image Banner */}
                <div
                  style={{
                    height: 154,
                    borderRadius: 12,
                    overflow: "hidden",
                    position: "relative",
                    marginBottom: 14,
                    background: item.imageUrl ? "#090d16" : fallbackGradient,
                  }}
                >
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  )}

                  {/* Edit icon overlay on hover */}
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      background: "rgba(15, 23, 42, 0.75)",
                      backdropFilter: "blur(4px)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#e2e8f0",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                    }}
                  >
                    <Pencil size={13} />
                  </div>
                </div>

                {/* Title */}
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: isOutOfStock ? "#cbd5e1" : "#f8fafc",
                    letterSpacing: "-0.01em",
                    margin: "0 0 4px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={item.name}
                >
                  {item.name}
                </div>

                {/* Description */}
                <div
                  style={{
                    fontSize: 13,
                    color: "#94a3b8",
                    margin: "0 0 14px",
                    minHeight: 18,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={item.description || ""}
                >
                  {item.description || "—"}
                </div>

                {/* Coin Cost and Stock Row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: isOutOfStock ? "#64748b" : "#B5E82C",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {item.coinCost} coins
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: isOutOfStock ? "#ef4444" : "#94a3b8",
                    }}
                  >
                    Stock: {item.stock}
                  </div>
                </div>

                {/* Status Badge */}
                <div style={{ display: "flex", alignItems: "center" }}>
                  {isOutOfStock ? (
                    <span
                      style={{
                        background: "#281212",
                        color: "#f87171",
                        border: "1px solid #451a1a",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        padding: "3px 8px",
                        borderRadius: 6,
                      }}
                    >
                      OUT OF STOCK
                    </span>
                  ) : isActive ? (
                    <span
                      style={{
                        background: "#052e16",
                        color: "#34d399",
                        border: "1px solid #14532d",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        padding: "3px 8px",
                        borderRadius: 6,
                      }}
                    >
                      ACTIVE
                    </span>
                  ) : (
                    <span
                      style={{
                        background: "#1e293b",
                        color: "#94a3b8",
                        border: "1px solid #334155",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        padding: "3px 8px",
                        borderRadius: 6,
                      }}
                    >
                      INACTIVE
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Store Item Modal */}
      <StoreItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveItem}
        initialData={editingItem}
      />
    </div>
  );
}
