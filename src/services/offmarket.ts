// ─────────────────────────────────────────────
// src/services/offmarket.ts
// Inscription liste off-market depuis /off-market.
// Passe par l'Edge Function submit-form (Turnstile + validation serveur).
// ─────────────────────────────────────────────
import { submitForm } from './submissions'
import type { TablesInsert } from '../types/supabase'

export type OffmarketPayload = TablesInsert<'offmarket_submissions'>

export async function submitOffmarket(
  payload: OffmarketPayload,
  turnstileToken: string | null,
): Promise<string | null> {
  return submitForm('offmarket', { ...payload } as Record<string, unknown>, turnstileToken)
}
