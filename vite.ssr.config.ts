// Build serveur (après le build client) : dist-ssr/pages.js (rendu React des fiches, catalogues,
// sitemap) et dist-ssr/og.js (images de partage, Sharp externe). Tout le reste est embarqué
// dans les bundles pour que les fonctions Vercel (api/*.js) n'aient rien d'autre à résoudre.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, mergeConfig, type Plugin, type UserConfig } from 'vite'
import baseConfig from './vite.config'

function virtualModules(): Plugin {
  const ids: Record<string, () => string> = {
    'virtual:hamac-shell': () => {
      const shell = readFileSync(path.resolve('dist/index.html'), 'utf8')
      return `export default ${JSON.stringify(shell)}`
    },
    'virtual:hamac-default-og': () => {
      const bytes = readFileSync(path.resolve('public/images/og/hamac-og-1200x630.jpg'))
      return `export default ${JSON.stringify(bytes.toString('base64'))}`
    },
  }
  return {
    name: 'hamac-ssr-virtual',
    resolveId(id) {
      return id in ids ? `\0${id}` : null
    },
    load(id) {
      const key = id.startsWith('\0') ? id.slice(1) : null
      return key && key in ids ? ids[key]() : null
    },
  }
}

export default defineConfig((env) => {
  const base = typeof baseConfig === 'function' ? baseConfig(env) : baseConfig
  return mergeConfig(base as UserConfig, {
    plugins: [virtualModules()],
    publicDir: false,
    build: {
      ssr: true,
      outDir: 'dist-ssr',
      emptyOutDir: true,
      target: 'node22',
      sourcemap: false,
      minify: false,
      copyPublicDir: false,
      rollupOptions: {
        input: { pages: 'server/pages.tsx', og: 'server/og.ts' },
        output: { format: 'es', entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js' },
      },
    },
    ssr: {
      // Tout embarquer sauf Sharp (binaire natif, fourni par node_modules dans la fonction).
      noExternal: true,
      external: ['sharp'],
      target: 'node',
    },
  } satisfies UserConfig)
})
