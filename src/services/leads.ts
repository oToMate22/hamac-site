// ─────────────────────────────────────────────
// src/services/leads.ts
// Formulaire contact général + demande sur un bien
// ─────────────────────────────────────────────
import { supabase } from '../lib/supabase'
import type { TablesInsert } from '../types/supabase'

export type LeadPayload = TablesInsert<'leads'>

export async function submitLead(payload: LeadPayload): Promise<void> {
  const { error } = await supabase.from('leads').insert(payload)
  if (error) throw new Error(error.message)
}

// Usage formulaire contact général :
// await submitLead({ nom: 'Jean Dupont', email: 'j@exemple.fr', type_contact: 'contact' })

// Usage demande sur un bien depuis /acheter/:slug :
// await submitLead({ nom, email, telephone, message, type_contact: 'bien', bien_ref: property.reference })
