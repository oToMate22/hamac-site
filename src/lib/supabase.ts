import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

function readSupabaseEnv() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  return { supabaseUrl, supabaseAnonKey }
}

export const isSupabaseConfigured = () => {
  const { supabaseUrl, supabaseAnonKey } = readSupabaseEnv()
  return Boolean(supabaseUrl && supabaseAnonKey)
}

/** Client Supabase (lazy). Ne lance pas d'erreur à l'import du module. */
export function getSupabase(): SupabaseClient {
  if (client) return client

  const { supabaseUrl, supabaseAnonKey } = readSupabaseEnv()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Variables Supabase manquantes : définir VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (.env.local ou Vercel).',
    )
  }

  client = createClient(supabaseUrl, supabaseAnonKey)
  return client
}

/** Client Supabase pour les formulaires : `supabase.from('leads').insert(...)` */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const value = Reflect.get(getSupabase(), prop, getSupabase())
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(getSupabase()) : value
  },
})
