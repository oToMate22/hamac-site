// ─────────────────────────────────────────────
// src/services/leads.ts
// Formulaire contact général + demande sur un bien.
// Passe par l'Edge Function submit-form (Turnstile + validation serveur).
// ─────────────────────────────────────────────
import { submitForm } from './submissions'
import type { TablesInsert } from '../types/supabase'

export type LeadPayload = TablesInsert<'leads'>

export async function submitLead(
  payload: LeadPayload,
  turnstileToken: string | null,
): Promise<string | null> {
  const form = payload.type_contact === 'bien' ? 'bien' : 'contact'
  return submitForm(form, { ...payload } as Record<string, unknown>, turnstileToken)
}
