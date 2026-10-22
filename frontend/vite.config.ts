import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// The dev server proxies to the API. Inside a container the API is reachable
// through the host gateway, so the target can be overridden.
const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8080'
const wsTarget = apiTarget.replace(/^http/, 'ws')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/ws': {
        target: wsTarget,
        ws: true,
      },
    },
  },
})
