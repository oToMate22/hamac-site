import { createContext, useContext, type ReactNode } from 'react'
import type { FeaturedProperty } from '../services/apimo'

/**
 * Données fournies par le rendu serveur (server/pages.tsx) aux pages du catalogue.
 * Côté navigateur le contexte reste vide : les pages chargent leurs données comme avant,
 * et main.ts remplace de toute façon le HTML serveur au démarrage (createRoot, pas d'hydratation).
 */
export type SsrData = {
  /** Biens d'une rubrique (vente ou location), pour rendre la liste sans JavaScript. */
  catalog?: FeaturedProperty[]
  /** Statut d'une fiche absente : retirée (410) ou inconnue (404). */
  listingStatus?: 'withdrawn' | 'unknown'
}

const SsrDataContext = createContext<SsrData>({})

export function SsrDataProvider({ value, children }: { value: SsrData; children: ReactNode }) {
  return <SsrDataContext.Provider value={value}>{children}</SsrDataContext.Provider>
}

export function useSsrData() {
  return useContext(SsrDataContext)
}
