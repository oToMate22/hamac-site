import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5180,
    strictPort: false,
    // Écoute sur toutes les interfaces (127.0.0.1 + localhost) — requis pour le Simple Browser Cursor
    host: true,
    // Autorise les requêtes depuis le navigateur intégré de l’IDE (hostnames proxy / tunnel)
    allowedHosts: true,
    hmr: {
      host: 'localhost',
      protocol: 'ws',
    },
  },
  preview: {
    port: 5180,
    host: true,
    allowedHosts: true,
  },
})
