import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the API runs separately; in production the backend serves this build.
    proxy: { '/api': 'http://localhost:3333' },
  },
});
