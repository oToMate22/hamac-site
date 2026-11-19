import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CONSENT_CHANGED_EVENT } from '../consent/storage'
import { trackingConfigured } from './config'
import { trackPageView } from './track'

/**
 * page_view de chaque route (socle OTOMATE).
 * Le push est différé d'un tick pour laisser usePageMeta mettre à jour document.title.
 * Sans consentement, la route est seulement mémorisée (référent réel), rien n'est envoyé.
 */
export function Analytics() {
  const { pathname, search } = useLocation()
  const [consentVersion, setConsentVersion] = useState(0)

  useEffect(() => {
    const sync = () => setConsentVersion((value) => value + 1)
    window.addEventListener(CONSENT_CHANGED_EVENT, sync)
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync)
  }, [])

  useEffect(() => {
    if (!trackingConfigured()) return
    const timer = window.setTimeout(() => trackPageView(pathname), 0)
    return () => window.clearTimeout(timer)
  }, [pathname, search, consentVersion])

  return null
}
