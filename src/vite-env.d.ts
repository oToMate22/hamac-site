/// <reference types="vite/client" />

declare module '*.html?raw' {
  const html: string
  export default html
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VERCEL_PROJECT_PRODUCTION_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
