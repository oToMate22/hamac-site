import { getSupabase, isSupabaseConfigured } from './supabase'

export type ContactLeadPayload = {
  nom: string
  email: string
  telephone: string
  message: string
  type_contact: string
}

export type ContactLeadResult =
  | { ok: true }
  | { ok: false; reason: 'missing_config' | 'validation' | 'network' | 'insert_failed' | 'rls'; detail?: string }

export async function submitContactLead(payload: ContactLeadPayload): Promise<ContactLeadResult> {
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      code?: string
      message?: string
    }

    if (response.ok && data.ok) return { ok: true }

    if (response.status === 404) {
      return submitContactLeadDirect(payload)
    }

    if (data.error === 'missing_config') return { ok: false, reason: 'missing_config' }
    if (data.error === 'validation') return { ok: false, reason: 'validation', detail: data.message }
    if (data.code === '42501' || (data.message ?? '').toLowerCase().includes('row-level security')) {
      return { ok: false, reason: 'rls', detail: data.message }
    }

    return { ok: false, reason: 'insert_failed', detail: data.message }
  } catch (error) {
    console.warn('[contact] API route unavailable, trying direct Supabase', error)
    return submitContactLeadDirect(payload)
  }
}

async function submitContactLeadDirect(payload: ContactLeadPayload): Promise<ContactLeadResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, reason: 'missing_config' }
  }

  const { error } = await getSupabase().from('leads').insert(payload)

  if (error) {
    const isRls =
      error.code === '42501' || (error.message ?? '').toLowerCase().includes('row-level security')
    return { ok: false, reason: isRls ? 'rls' : 'insert_failed', detail: error.message }
  }

  return { ok: true }
}
