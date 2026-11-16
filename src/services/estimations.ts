// ─────────────────────────────────────────────
// src/services/estimations.ts
// Formulaire d'estimation depuis /estimation.
// Passe par l'Edge Function submit-form (Turnstile + validation serveur).
// ─────────────────────────────────────────────
import { submitForm } from './submissions'
import type { TablesInsert } from '../types/supabase'

export type EstimationPayload = TablesInsert<'estimation_submissions'>

export async function submitEstimation(
  payload: EstimationPayload,
  turnstileToken: string | null,
): Promise<string | null> {
  return submitForm('estimation', { ...payload } as Record<string, unknown>, turnstileToken)
}
