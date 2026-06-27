/**
 * BIMA App Config
 * Change this file to rebrand the entire app.
 */

import logo from "./assets/logo.png";

export const APP_CONFIG = {
  name: "Being Infinity",
  fullName: "Being Infinity App Dashboard",
  tagline: "Admin Dashboard",
  org: "BIMA",
  logo: logo,

  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",

  quiz: {
    limits: {
      questionText: 120,
      optionText: 50,
    },
  },

  theme: {
    primary: "#87ae1a",
    primaryDark: "#6c891d",
    primaryLight: "#5d7a0c",
    primaryText: "#e0f2fe",

    sidebarBg: "#020617",
    sidebarBorder: "#0f172a",
    sidebarText: "#94a3b8",
    sidebarActive: "#111827",
    sidebarActiveText: "#B5E82C",

    pageBg: "#030712",
    cardBg: "#111827",
    cardBorder: "#1f2937",

    textPrimary: "#f8fafc",
    textSecondary: "#cbd5e1",
    textMuted: "#94a3b8",

    success: { bg: "#052e16", text: "#bbf7d0", dot: "#22c55e" },
    warning: { bg: "#3f2a06", text: "#fde68a", dot: "#f59e0b" },
    danger: { bg: "#3b0a0a", text: "#fecaca", dot: "#ef4444" },
    info: { bg: "#082f49", text: "#bae6fd", dot: "#38bdf8" },
    neutral: { bg: "#1e293b", text: "#cbd5e1", dot: "#64748b" },
  },
};

export default APP_CONFIG;
