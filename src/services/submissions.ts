// ─────────────────────────────────────────────
// src/services/submissions.ts
// Envoi unique des 4 formulaires vers l'Edge Function `submit-form`.
// Remplace l'insertion anonyme directe : plus aucune clé publique ne peut
// écrire dans les tables depuis le navigateur.
// ─────────────────────────────────────────────

import { supabase } from '../lib/supabase'

export type FormKind = 'contact' | 'bien' | 'estimation' | 'offmarket'

export type FieldError = { field: string; message: string }

export type SubmissionErrorCode = 'turnstile' | 'rate_limited' | 'invalid' | 'network' | 'server'

export class SubmissionError extends Error {
  code: SubmissionErrorCode
  fields: FieldError[]

  constructor(code: SubmissionErrorCode, message: string, fields: FieldError[] = []) {
    super(message)
    this.name = 'SubmissionError'
    this.code = code
    this.fields = fields
  }
}

const MESSAGES = {
  turnstile: 'La vérification anti-robot n’a pas abouti. Rechargez la page et réessayez.',
  rate_limited: 'Trop de demandes envoyées depuis votre connexion. Merci de réessayer dans quelques minutes ou de nous appeler.',
  invalid: 'Certaines informations sont invalides. Vérifiez vos coordonnées.',
  network: 'Connexion impossible. Vérifiez votre réseau et réessayez.',
  server: 'Une erreur est survenue. Merci de réessayer ou de nous contacter par téléphone.',
} as const

type ErrorBody = { error?: string; fields?: FieldError[] }

async function readErrorBody(error: unknown): Promise<ErrorBody | null> {
  const context = (error as { context?: unknown })?.context
  if (context && typeof (context as Response).json === 'function') {
    try {
      return (await (context as Response).json()) as ErrorBody
    } catch {
      return null
    }
  }
  return null
}

/**
 * @param data charge utile telle qu'attendue par la table cible
 * @param turnstileToken token Cloudflare, vérifié côté serveur
 * @returns l'identifiant de la ligne créée (ou null)
 */
export async function submitForm(
  form: FormKind,
  data: Record<string, unknown>,
  turnstileToken: string | null,
): Promise<string | null> {
  if (!turnstileToken) throw new SubmissionError('turnstile', MESSAGES.turnstile)

  try {
    const { data: response, error } = await supabase.functions.invoke('submit-form', {
      body: { form, turnstileToken, data },
    })

    if (error) {
      const body = await readErrorBody(error)
      switch (body?.error) {
        case 'turnstile_failed':
          throw new SubmissionError('turnstile', MESSAGES.turnstile)
        case 'rate_limited':
          throw new SubmissionError('rate_limited', MESSAGES.rate_limited)
        case 'invalid_payload':
          throw new SubmissionError(
            'invalid',
            body.fields?.[0]?.message ?? MESSAGES.invalid,
            body.fields ?? [],
          )
        default:
          throw new SubmissionError('server', MESSAGES.server)
      }
    }

    return (response as { id?: string } | null)?.id ?? null
  } catch (err) {
    if (err instanceof SubmissionError) throw err
    throw new SubmissionError('network', MESSAGES.network)
  }
}

/** Message affichable, quel que soit l'erreur remontée. */
export function submissionErrorMessage(error: unknown): string {
  return error instanceof SubmissionError ? error.message : MESSAGES.server
}
