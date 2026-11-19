import { SubmissionError, type FormKind } from '../services/submissions'
import { track } from './track'

/**
 * Échec d'envoi déjà classé par le service.
 * Le texte renvoyé et les champs saisis ne sont pas des paramètres.
 */
export function trackFormFailure(form: FormKind, error: unknown): void {
  if (!(error instanceof SubmissionError)) return
  track('form_error', { form, error_code: error.code })
}
