// ─────────────────────────────────────────────
// src/lib/turnstile.ts
// Chargement du widget Cloudflare Turnstile et récupération d'un token
// au moment exact de l'envoi (les tokens expirent en 300 s et sont à usage
// unique : inutile de les demander à l'affichage du formulaire).
//
// Le token n'est PAS une preuve : il est vérifié côté serveur par l'Edge
// Function `submit-form` (siteverify). Ici on ne fait que le produire.
// ─────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__hamacTurnstileOnload'

export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').trim()

type TurnstileOptions = {
  sitekey: string
  action?: string
  appearance?: 'always' | 'execute' | 'interaction-only'
  execution?: 'render' | 'execute'
  theme?: 'light' | 'dark' | 'auto'
  language?: string
  callback?: (token: string) => void
  'error-callback'?: (code?: string) => void
  'expired-callback'?: () => void
  'timeout-callback'?: () => void
}

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string | null | undefined
  execute: (widgetId: string) => void
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
    __hamacTurnstileOnload?: () => void
  }
}

let loader: Promise<TurnstileApi | null> | null = null

/** Charge le script officiel une seule fois. `null` = widget indisponible. */
export function loadTurnstile(): Promise<TurnstileApi | null> {
  if (!TURNSTILE_SITE_KEY) return Promise.resolve(null)
  if (typeof window === 'undefined') return Promise.resolve(null)
  // Pendant le prerender (Chromium headless), on n'injecte rien :
  // le HTML statique ne doit pas embarquer de challenge.
  if (navigator.webdriver) return Promise.resolve(null)
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loader) return loader

  loader = new Promise<TurnstileApi | null>((resolve) => {
    const finish = (api: TurnstileApi | null) => {
      clearTimeout(timer)
      resolve(api)
    }
    const timer = setTimeout(() => finish(null), 10_000)
    window.__hamacTurnstileOnload = () => finish(window.turnstile ?? null)
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onerror = () => finish(null)
    document.head.appendChild(script)
  })

  return loader
}

type Pending = {
  resolve: (token: string) => void
  reject: () => void
}

export type TurnstileHandle = {
  containerRef: RefObject<HTMLDivElement | null>
  /** Demande un token frais ; `null` si la vérification est impossible. */
  getToken: (timeoutMs?: number) => Promise<string | null>
  reset: () => void
  status: 'loading' | 'ready' | 'unavailable'
}

export function useTurnstile(action: string): TurnstileHandle {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const pendingRef = useRef<Pending | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  useEffect(() => {
    let cancelled = false

    loadTurnstile().then((api) => {
      if (cancelled) return
      if (!api || !containerRef.current) {
        setStatus('unavailable')
        return
      }
      const id = api.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        action,
        // N'apparaît que si Cloudflare juge une interaction nécessaire.
        appearance: 'interaction-only',
        // Pas de token avant l'appel explicite à execute().
        execution: 'execute',
        theme: 'light',
        language: 'fr',
        callback: (token) => {
          pendingRef.current?.resolve(token)
          pendingRef.current = null
        },
        'error-callback': () => {
          pendingRef.current?.reject()
          pendingRef.current = null
        },
        'timeout-callback': () => {
          pendingRef.current?.reject()
          pendingRef.current = null
        },
        'expired-callback': () => {
          pendingRef.current?.reject()
          pendingRef.current = null
        },
      })
      widgetIdRef.current = id ?? null
      setStatus(id ? 'ready' : 'unavailable')
    })

    return () => {
      cancelled = true
      pendingRef.current?.reject()
      pendingRef.current = null
      const id = widgetIdRef.current
      widgetIdRef.current = null
      if (id && window.turnstile) {
        try {
          window.turnstile.remove(id)
        } catch {
          /* widget déjà détruit */
        }
      }
    }
  }, [action])

  const getToken = useCallback(async (timeoutMs = 20_000): Promise<string | null> => {
    const api = window.turnstile ?? (await loadTurnstile())
    const id = widgetIdRef.current
    if (!api || !id) return null

    return new Promise<string | null>((resolve) => {
      let settled = false
      const done = (token: string | null) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        pendingRef.current = null
        resolve(token)
      }
      const timer = setTimeout(() => done(null), timeoutMs)
      pendingRef.current = { resolve: (token) => done(token), reject: () => done(null) }
      try {
        api.reset(id)
        api.execute(id)
      } catch {
        done(null)
      }
    })
  }, [])

  const reset = useCallback(() => {
    const id = widgetIdRef.current
    if (id && window.turnstile) {
      try {
        window.turnstile.reset(id)
      } catch {
        /* ignoré */
      }
    }
  }, [])

  return { containerRef, getToken, reset, status }
}
