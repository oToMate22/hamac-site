export type ConsentState = {
  analytics: boolean
  updatedAt: number
}

const STORAGE_KEY = 'hamac_consent_v1'
const CONSENT_MAX_AGE_MS = 13 * 30 * 24 * 60 * 60 * 1000

export const CONSENT_CHANGED_EVENT = 'hamac:consent-changed'
export const OPEN_CONSENT_EVENT = 'hamac:open-consent'

export function readConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ConsentState>
    if (typeof parsed.analytics !== 'boolean') return null
    const updatedAt = typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0
    // Consentement trop ancien (ou sans date) : on le considère expiré et on repose la question.
    if (!updatedAt || Date.now() - updatedAt > CONSENT_MAX_AGE_MS) return null
    return { analytics: parsed.analytics, updatedAt }
  } catch {
    return null
  }
}

export function writeConsent(analytics: boolean): ConsentState {
  const next: ConsentState = { analytics, updatedAt: Date.now() }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT))
  return next
}

export function openConsentPreferences() {
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))
}
