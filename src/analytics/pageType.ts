// ─────────────────────────────────────────────
// src/analytics/pageType.ts
// Route React (sans le basename /fr) → page_type (liste fermée, §A3).
// ─────────────────────────────────────────────

export type PageType =
  | 'home'
  | 'listing_sale'
  | 'listing_rent'
  | 'property'
  | 'estimate'
  | 'contact'
  | 'offmarket'
  | 'selling'
  | 'invest'
  | 'agency'
  | 'neighborhood_index'
  | 'neighborhood'
  | 'blog_index'
  | 'blog_post'
  | 'legal'
  | 'not_found'

const EXACT: Record<string, PageType> = {
  '/': 'home',
  '/acheter': 'listing_sale',
  '/louer': 'listing_rent',
  '/vendre': 'selling',
  '/estimation': 'estimate',
  '/off-market': 'offmarket',
  '/quartiers': 'neighborhood_index',
  '/agence': 'agency',
  '/contact': 'contact',
  '/investir': 'invest',
  '/blog': 'blog_index',
  '/mentions-legales': 'legal',
  '/honoraires': 'legal',
  '/confidentialite': 'legal',
}

/** Chemin de route React (sans le basename Vite, ex. /fr) à partir de window.location. */
export function routePathFromWindow(): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const { pathname } = window.location
  if (base && (pathname === base || pathname.startsWith(`${base}/`))) return pathname.slice(base.length) || '/'
  return pathname || '/'
}

export function pageTypeFromPath(pathname: string): PageType {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const exact = EXACT[path]
  if (exact) return exact
  if (/^\/(acheter|louer)\/[^/]+$/.test(path)) return 'property'
  if (/^\/quartiers\/[^/]+$/.test(path)) return 'neighborhood'
  if (/^\/blog\/[^/]+$/.test(path)) return 'blog_post'
  return 'not_found'
}
