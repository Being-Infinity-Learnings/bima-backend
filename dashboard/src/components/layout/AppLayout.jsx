// Layout wrapper for authenticated dashboard pages.
//
// Displays the left sidebar and renders the selected page in the main content area.
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import APP_CONFIG from "../../config/app.config.js";

export default function AppLayout() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: APP_CONFIG.theme.pageBg,
      }}
    >
      <Sidebar />
      <main style={{ flex: 1, overflowY: "auto", maxHeight: "100vh" }}>
        <Outlet />
      </main>
    </div>
  );
}
