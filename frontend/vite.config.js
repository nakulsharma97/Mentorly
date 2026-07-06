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
  },
});
