// ─────────────────────────────────────────────
// src/components/TurnstileField.tsx
// Emplacement du widget Cloudflare Turnstile. Invisible en temps normal
// (appearance: interaction-only) : il ne s'affiche que si Cloudflare juge
// une interaction nécessaire.
// ─────────────────────────────────────────────

import type { RefObject } from 'react'

type Props = {
  containerRef: RefObject<HTMLDivElement | null>
  className?: string
}

export function TurnstileField({ containerRef, className }: Props) {
  return (
    <div
      ref={containerRef}
      className={['turnstile-field', className].filter(Boolean).join(' ')}
      // Cloudflare injecte son iframe ici ; on réserve une hauteur nulle
      // tant qu'aucune interaction n'est demandée.
      aria-live="polite"
    />
  )
}
