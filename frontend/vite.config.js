import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setupTests.js",
    exclude: ["node_modules/**", "dist/**", "e2e/**"],
  },
  build: {
    cssMinify: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) return 'vendor';
          if (id.includes('node_modules/react')) return 'react-core';
          if (id.includes('node_modules/@sentry')) return 'sentry';
          if (id.includes('node_modules/axios')) return 'libs';
          if (id.includes('node_modules/exceljs')) return 'exceljs';
          if (id.includes('node_modules/jspdf')) return 'pdf';
          if (id.includes('node_modules/html2canvas')) return 'canvas';
        },
      },
    },
  },
});
