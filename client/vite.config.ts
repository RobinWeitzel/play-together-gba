import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Node server (server workspace) handles /api/* and /ws and applies the
// cross-origin isolation headers itself. In dev we proxy everything there.
const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:8080";

const COOP_COEP_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Robots-Tag": "noindex",
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    // COOP/COEP on Vite's HTML/JS responses. /api and /ws are proxied to the
    // Node server which sets these headers itself.
    headers: COOP_COEP_HEADERS,
    proxy: {
      "/api": {
        target: SERVER_URL,
        changeOrigin: true,
      },
      "/ws": {
        target: SERVER_URL.replace(/^http/, "ws"),
        ws: true,
      },
    },
  },
  preview: {
    headers: COOP_COEP_HEADERS,
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
});
