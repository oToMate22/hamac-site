import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CONSENT_CHANGED_EVENT, readConsent } from '../consent/storage'
import { canTrackAnalytics, disableGa4, loadGa4, sendPageView } from './ga4'

export function Analytics() {
  const { pathname } = useLocation()
  const [consentVersion, setConsentVersion] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
    const sync = () => setConsentVersion((value) => value + 1)
    window.addEventListener(CONSENT_CHANGED_EVENT, sync)
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync)
  }, [])

  useEffect(() => {
    if (!ready) return

    const consent = readConsent()
    if (consent?.analytics === true && canTrackAnalytics()) {
      let cancelled = false
      void loadGa4()
        .then(() => {
          if (!cancelled) sendPageView(pathname)
        })
        .catch(() => {
          /* network / adblock — silent */
        })
      return () => {
        cancelled = true
      }
    }

    // Refus ou révocation explicite uniquement — pas au premier paint ni si indécis.
    if (consent?.analytics === false) {
      disableGa4()
    }
  }, [ready, consentVersion, pathname])

  return null
}
