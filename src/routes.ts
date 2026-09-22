export const STATIC_ROUTES = [
  '/',
  '/acheter',
  '/louer',
  '/vendre',
  '/estimation',
  '/off-market',
  '/quartiers',
  '/agence',
  '/contact',
  '/investir',
  '/blog',
  '/mentions-legales',
  '/honoraires',
  '/confidentialite',
] as const

export type StaticRoute = (typeof STATIC_ROUTES)[number]

export const NOT_FOUND_ROUTE = '*'
