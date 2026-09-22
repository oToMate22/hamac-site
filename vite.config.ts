import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function redirectToFr() {
  return {
    name: 'redirect-to-fr',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? '/'
        const pathOnly = raw.split('?')[0]
        const skip =
          pathOnly.startsWith('/fr') ||
          pathOnly.startsWith('/@') ||
          pathOnly.startsWith('/src') ||
          pathOnly.startsWith('/node_modules') ||
          pathOnly.startsWith('/images') ||
          pathOnly.startsWith('/favicon') ||
          pathOnly.startsWith('/apple-touch-icon') ||
          pathOnly.startsWith('/icons') ||
          pathOnly.startsWith('/video')
        if (skip) {
          next()
          return
        }
        res.statusCode = 302
        res.setHeader('Location', `/fr${raw === '/' ? '/' : raw}`)
        res.end()
      })
    },
  }
}

export default defineConfig({
  base: '/fr/',
  plugins: [react(), redirectToFr()],
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
