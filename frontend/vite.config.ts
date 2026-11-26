import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Polling is enabled to make source changes detectable on the Windows Docker
// bind mount where native inotify events do not cross into the container.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    watch: {
      usePolling: true,
      interval: 1000,
      ignored: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
    },
  },
});