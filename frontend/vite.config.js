import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setupTests.js',
    exclude: ['node_modules/**', 'dist/**', 'e2e/**']
  },
  build: {
    cssMinify: false
  }
});
