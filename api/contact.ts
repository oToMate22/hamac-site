import { createClient } from '@supabase/supabase-js'

type ContactBody = {
  nom?: string
  email?: string
  telephone?: string
  message?: string
  type_contact?: string
}

type VercelRequest = {
  method?: string
  body?: ContactBody
}

type VercelResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => { json: (body: unknown) => void; end: () => void }
}

function getServerSupabase() {
  const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').trim()
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  const anonKey = (process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  const key = serviceKey || anonKey

  if (!url || !key) return null
  return createClient(url, key)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const supabase = getServerSupabase()
  if (!supabase) {
    console.error('[api/contact] Missing SUPABASE_URL or key (SERVICE_ROLE or ANON)')
    return res.status(500).json({ error: 'missing_config' })
  }

  const body = req.body ?? {}
  const nom = String(body.nom ?? '').trim()
  const email = String(body.email ?? '').trim()
  const telephone = String(body.telephone ?? '').trim()
  const message = String(body.message ?? '').trim()
  const type_contact = String(body.type_contact ?? 'contact').trim()

  if (!nom || !email || !telephone) {
    return res.status(400).json({ error: 'validation', message: 'Champs requis manquants.' })
  }

  const { error } = await supabase.from('leads').insert({
    nom,
    email,
    telephone,
    message,
    type_contact,
  })

  if (error) {
    console.error('[api/contact] insert failed', error)
    return res.status(500).json({
      error: 'insert_failed',
      code: error.code,
      message: error.message,
    })
  }

  return res.status(200).json({ ok: true })
}
