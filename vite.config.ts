import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  server: {
    // Port dédié pour éviter le conflit avec hamac-site-equipe (ex. 5174)
    port: 5180,
    strictPort: false,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        biens: resolve(__dirname, 'biens/index.html'),
      },
    },
  },
})
