import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { DEFAULT_OG_IMAGE, SERVED_SITE_URL } from './src/config/site'

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
  define: {
    'import.meta.env.VERCEL_PROJECT_PRODUCTION_URL': JSON.stringify(
      process.env.VERCEL_PROJECT_PRODUCTION_URL ?? '',
    ),
  },
  plugins: [
    react(),
    redirectToFr(),
    {
      name: 'share-meta-served-origin',
      transformIndexHtml(html) {
        return html
          .replace(
            /(<meta property="og:url" content=")[^"]*(")/,
            `$1${SERVED_SITE_URL}/$2`,
          )
          .replace(
            /(<meta property="og:image" content=")[^"]*(")/,
            `$1${DEFAULT_OG_IMAGE}$2`,
          )
          .replace(
            /(<meta name="twitter:image" content=")[^"]*(")/,
            `$1${DEFAULT_OG_IMAGE}$2`,
          )
      },
    },
  ],
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
