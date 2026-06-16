// ─────────────────────────────────────────────
// src/services/offmarket.ts
// Formulaire inscription liste off-market depuis /off-market
// ─────────────────────────────────────────────
import { supabase } from '../lib/supabase'
import type { TablesInsert } from '../types/supabase'

export type OffmarketPayload = TablesInsert<'offmarket_submissions'>

export async function submitOffmarket(payload: OffmarketPayload): Promise<void> {
  const { error } = await supabase.from('offmarket_submissions').insert(payload)
  if (error) throw new Error(error.message)
}

// Usage :
// await submitOffmarket({
//   first_name: 'Sophie',
//   last_name: 'Martin',
//   email: 's@exemple.fr',
//   phone: '06...',
//   property_type: 'maison',
//   sector: 'Sainte-Foy-lès-Lyon',
//   budget: '500000-700000',
// })
