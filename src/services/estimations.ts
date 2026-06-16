// ─────────────────────────────────────────────
// src/services/estimations.ts
// Formulaire d'estimation depuis /estimation
// ─────────────────────────────────────────────
import { supabase } from '../lib/supabase'
import type { TablesInsert } from '../types/supabase'

export type EstimationPayload = TablesInsert<'estimation_submissions'>

export async function submitEstimation(payload: EstimationPayload): Promise<void> {
  const { error } = await supabase.from('estimation_submissions').insert(payload)
  if (error) throw new Error(error.message)
}

// Usage :
// await submitEstimation({
//   nom: 'Martin',
//   prenom: 'Sophie',
//   email: 's@exemple.fr',
//   telephone: '06...',
//   property_type: 'maison',
//   city: 'Sainte-Foy-lès-Lyon',
//   surface_habitable: 120,
//   nombre_pieces: 5,
// })
