// ─────────────────────────────────────────────
// src/analytics/cookies.ts
// Purge des cookies GA4 (_ga, _ga_<ID>), reprise de l'ancien ga4.ts.
// ─────────────────────────────────────────────

import { BASE_PATH } from '../config/site'
import { GA_MEASUREMENT_ID } from './config'

/** Ancien flux provisoire — à purger si encore présent sur le navigateur. */
const LEGACY_GA_COOKIE_SUFFIXES = ['WV45LNS0KK']

function gaCookieNames(): string[] {
  const names = new Set<string>(['_ga'])
  const suffix = GA_MEASUREMENT_ID.replace(/^G-/i, '')
  if (suffix) names.add(`_ga_${suffix}`)
  for (const legacy of LEGACY_GA_COOKIE_SUFFIXES) names.add(`_ga_${legacy}`)
  for (const part of document.cookie.split(';')) {
    const name = part.trim().split('=')[0]
    if (name === '_ga' || name.startsWith('_ga_')) names.add(name)
  }
  return [...names]
}

function cookiePaths(): string[] {
  const paths = new Set<string>(['/', BASE_PATH || '/fr', `${BASE_PATH || '/fr'}/`])
  let acc = ''
  for (const segment of location.pathname.split('/').filter(Boolean)) {
    acc += `/${segment}`
    paths.add(acc)
    paths.add(`${acc}/`)
  }
  return [...paths]
}

function cookieDomains(): Array<string | undefined> {
  const host = location.hostname
  return [
    ...new Set([
      undefined, // host-only
      host,
      host.startsWith('.') ? host : `.${host}`,
      'hamacpatrimoine.com',
      '.hamacpatrimoine.com',
    ]),
  ]
}

/** Supprime _ga / _ga_<ID> (host-only + Domain=.hamacpatrimoine.com, path=/ et chemins parcourus). */
export function purgeGaCookies() {
  if (typeof document === 'undefined') return
  const expires = 'Thu, 01 Jan 1970 00:00:00 GMT'
  for (const name of gaCookieNames()) {
    for (const domain of cookieDomains()) {
      for (const path of cookiePaths()) {
        let value = `${name}=; Expires=${expires}; Max-Age=0; Path=${path}`
        if (domain) value += `; Domain=${domain}`
        document.cookie = value
      }
    }
  }
}
