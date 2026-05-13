import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001, host: true,
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react:  ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          ui:     ['lucide-react', 'react-hot-toast'],
          http:   ['axios'],
        }
      }
    }
  }
});
