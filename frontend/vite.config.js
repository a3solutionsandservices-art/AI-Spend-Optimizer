import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/subscriptions':   { target: 'http://localhost:3001', changeOrigin: true },
      '/insights':        { target: 'http://localhost:3001', changeOrigin: true },
      '/detect-category': { target: 'http://localhost:3001', changeOrigin: true },
      '/scan':            { target: 'http://localhost:3001', changeOrigin: true },
      '/auth':            { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
