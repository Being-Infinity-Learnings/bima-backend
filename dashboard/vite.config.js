// Vite configuration for the dashboard application.
//
// Uses the React plugin and exports the build/development config.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
