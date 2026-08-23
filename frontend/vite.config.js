import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import compression from "vite-plugin-compression";

export default defineConfig({
  plugins: [
    react(),
    compression({ algorithm: "gzip" }),
    compression({ algorithm: "brotliCompress" }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
      "/oauth2": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
      "/login/oauth2": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
      "/ws": {
        target: "http://localhost:8080",
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 5174,
    // Mirror the dev-server proxy so `vite preview` (prod build) can be
    // exercised locally against the real backend without CORS or a custom
    // VITE_API_BASE_URL.
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
      "/oauth2": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
      "/ws": {
        target: "http://localhost:8080",
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setupTests.js",
    exclude: ["node_modules/**", "dist/**", "e2e/**"],
  },
  build: {
    cssMinify: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── Core framework (needed on every page) ──
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) return 'vendor';
          if (id.includes('node_modules/react') && !id.includes('react-dom') && !id.includes('react-router')) return 'react-core';
          if (id.includes('node_modules/axios')) return 'libs';

          // ── Heavy libs that are NOT needed for first paint ──
          if (id.includes('node_modules/@sentry')) return 'sentry';
          if (id.includes('node_modules/framer-motion')) return 'motion';
          if (id.includes('node_modules/lucide-react')) return 'icons';
          if (id.includes('node_modules/exceljs')) return 'exceljs';
          if (id.includes('node_modules/jspdf')) return 'pdf';
          if (id.includes('node_modules/html2canvas')) return 'canvas';
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs')) return 'charts';

          // ── Workspace shell (sidebar + topbar) — loaded only for authenticated pages ──
          if (id.includes('/modules/common/workspace/')) return 'workspace';

          // ── Chat module — only loaded when user navigates to /messages ──
          if (id.includes('/modules/messages/')) return 'chat';

          // ── Admin module — only loaded for admin routes ──
          if (id.includes('/modules/admin/')) return 'admin';

          // ── Mentor module — only loaded for mentor routes ──
          if (id.includes('/modules/mentor/')) return 'mentor';

          // ── Landing page (public, non-authenticated) ──
          if (id.includes('/pages/AuthPage') || id.includes('/pages/CompleteProfile') || id.includes('/pages/ProfileSetup')) return 'landing';
        },
      },
    },
  },
});
