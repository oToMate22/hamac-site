import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { disableGa4 } from '../analytics/ga4'
import { OPEN_CONSENT_EVENT, readConsent, writeConsent } from './storage'

export function CookieBanner() {
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState(false)
  const [analyticsDraft, setAnalyticsDraft] = useState(false)

  useEffect(() => {
    // Pas de bandeau dans le HTML pré-rendu (Googlebot / CLS / poids).
    if (window.__PRERENDER__) {
      setReady(true)
      setOpen(false)
      return
    }
    const stored = readConsent()
    setAnalyticsDraft(stored?.analytics ?? false)
    setOpen(stored === null)
    setReady(true)

    const onOpen = () => {
      const current = readConsent()
      setAnalyticsDraft(current?.analytics ?? false)
      setPanel(true)
      setOpen(true)
    }
    window.addEventListener(OPEN_CONSENT_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, onOpen)
  }, [])

  if (!ready || !open) return null

  const save = (analytics: boolean) => {
    writeConsent(analytics)
    if (!analytics) disableGa4()
    setAnalyticsDraft(analytics)
    setPanel(false)
    setOpen(false)
  }

  return (
    <div className="cookie-banner" role="dialog" aria-labelledby="cookie-banner-title" aria-modal="false">
      <div className="cookie-banner__inner">
        <div className="cookie-banner__copy">
          <p id="cookie-banner-title" className="cookie-banner__title">
            Cookies
          </p>
          <p className="cookie-banner__text">
            Nous utilisons des cookies de mesure d’audience (Google Analytics 4) uniquement avec votre
            accord. Vous pouvez accepter, refuser ou personnaliser.{' '}
            <Link to="/confidentialite">Politique de confidentialité</Link>
          </p>
        </div>

        {panel ? (
          <div className="cookie-banner__prefs">
            <label className="cookie-banner__toggle">
              <input
                type="checkbox"
                checked={analyticsDraft}
                onChange={(event) => setAnalyticsDraft(event.target.checked)}
              />
              <span>Mesure d’audience (Google Analytics 4)</span>
            </label>
            <div className="cookie-banner__actions">
              <button type="button" className="cookie-banner__btn cookie-banner__btn--ghost" onClick={() => save(false)}>
                Tout refuser
              </button>
              <button
                type="button"
                className="cookie-banner__btn cookie-banner__btn--primary"
                onClick={() => save(analyticsDraft)}
              >
                Enregistrer
              </button>
            </div>
          </div>
        ) : (
          <div className="cookie-banner__actions">
            <button type="button" className="cookie-banner__btn cookie-banner__btn--ghost" onClick={() => save(false)}>
              Tout refuser
            </button>
            <button type="button" className="cookie-banner__btn cookie-banner__btn--ghost" onClick={() => setPanel(true)}>
              Personnaliser
            </button>
            <button type="button" className="cookie-banner__btn cookie-banner__btn--primary" onClick={() => save(true)}>
              Tout accepter
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
