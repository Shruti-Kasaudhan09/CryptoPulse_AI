import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development, /api calls are proxied to the FastAPI server on :8000,
// so no CORS setup is needed locally. In production set VITE_API_URL.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,   
    proxy: { "/api": "http://localhost:8000" },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { charts: ["recharts"], react: ["react", "react-dom", "react-router-dom"] },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
  },
});
