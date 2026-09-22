import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BLOG_POSTS } from '../src/data/blogPosts'
import { NEIGHBORHOODS } from '../src/data/neighborhoods'
import { STATIC_ROUTES } from '../src/routes'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
export const APIMO_ROUTES_PATH = path.join(ROOT, 'data', 'apimo-routes.json')
const MAX_AGE_MS = 24 * 60 * 60 * 1000

export type ApimoRoutesFile = {
  generatedAt: string
  routes: string[]
}

type ApimoListPayload = {
  properties?: Array<{ id?: unknown; price?: { period?: unknown } }>
  data?: { properties?: Array<{ id?: unknown; price?: { period?: unknown } }> }
}

class ApimoHttpError extends Error {
  status: number
  retryAfterMs?: number
  constructor(status: number, retryAfterMs?: number) {
    super(`apimo-proxy HTTP ${status}`)
    this.status = status
    this.retryAfterMs = retryAfterMs
  }
}

function staticRoutes() {
  return new Set<string>([
    ...STATIC_ROUTES,
    ...BLOG_POSTS.map((post) => `/blog/${post.slug}`),
    ...NEIGHBORHOODS.map((neighborhood) => `/quartiers/${neighborhood.slug}`),
  ])
}

function mergeRoutes(propertyRoutes: string[]) {
  const routes = staticRoutes()
  for (const route of propertyRoutes) routes.add(route)
  return routes
}

function formatDayMonth(iso: string) {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return iso
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryAfterMs(res: Response, fallback: number) {
  const header = res.headers.get('Retry-After')
  if (!header) return fallback
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(header)
  if (Number.isFinite(date)) return Math.max(0, date - Date.now())
  return fallback
}

export async function readApimoRoutesFile(): Promise<ApimoRoutesFile | null> {
  try {
    const raw = await readFile(APIMO_ROUTES_PATH, 'utf8')
    const parsed = JSON.parse(raw) as ApimoRoutesFile
    if (!Array.isArray(parsed.routes) || typeof parsed.generatedAt !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export async function writeApimoRoutesFile(routes: string[]) {
  const payload: ApimoRoutesFile = {
    generatedAt: new Date().toISOString(),
    routes: [...routes].sort((a, b) => a.localeCompare(b)),
  }
  await mkdir(path.dirname(APIMO_ROUTES_PATH), { recursive: true })
  await writeFile(APIMO_ROUTES_PATH, `${JSON.stringify(payload, null, 2)}\n`)
  return payload
}

async function fetchPropertyRoutesOnce(supabaseUrl: string, anon: string): Promise<string[]> {
  const res = await fetch(`${supabaseUrl}/functions/v1/apimo-proxy`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ route: 'properties' }),
  })
  if (!res.ok) {
    throw new ApimoHttpError(res.status, retryAfterMs(res, res.status === 429 ? 0 : 1000))
  }
  const payload = (await res.json()) as ApimoListPayload
  const list = payload.properties ?? payload.data?.properties ?? []
  const propertyRoutes: string[] = []
  for (const property of list) {
    if (property.id == null) continue
    const isRental = property.price?.period !== null && property.price?.period !== undefined
    propertyRoutes.push(`${isRental ? '/louer' : '/acheter'}/${property.id}`)
  }
  console.log(`${list.length} biens Apimo ajoutés aux routes`)
  return propertyRoutes
}

async function fetchPropertyRoutes(supabaseUrl: string, anon: string): Promise<string[]> {
  let lastError: unknown
  let remaining429 = 2

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await fetchPropertyRoutesOnce(supabaseUrl, anon)
    } catch (error) {
      lastError = error
      if (!(error instanceof ApimoHttpError)) throw error

      if (error.status === 429) {
        remaining429 -= 1
        if (remaining429 <= 0) throw error
        const wait = error.retryAfterMs && error.retryAfterMs > 0 ? error.retryAfterMs : 1000
        console.warn(`Quota Apimo (HTTP 429), nouvelle tentative dans ${Math.round(wait / 1000)} s…`)
        await sleep(wait)
        continue
      }

      if (error.status >= 500 && error.status < 600 && attempt < 3) {
        const delays = [1000, 4000, 12000]
        const wait = error.retryAfterMs && error.retryAfterMs > 0 ? error.retryAfterMs : delays[attempt] ?? 12000
        console.warn(`apimo-proxy HTTP ${error.status}, nouvelle tentative dans ${Math.round(wait / 1000)} s…`)
        await sleep(wait)
        continue
      }

      throw error
    }
  }

  throw lastError
}

function announceStaleFile(file: ApimoRoutesFile, quota: boolean) {
  const when = formatDayMonth(file.generatedAt)
  if (quota) {
    console.warn(
      `Quota quotidien Apimo atteint (HTTP 429).\nPré-rendu poursuivi avec data/apimo-routes.json (générée le ${when}).\nLes nouvelles fiches seront pré-rendues au prochain build.`,
    )
    return
  }
  console.warn(`Liste de routes servie depuis data/apimo-routes.json (générée le ${when}).`)
}

export async function collectRoutes(options?: { forceRefresh?: boolean }) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anon) {
    throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY absents : les fiches biens ne seraient pas pré-rendues')
  }

  const file = await readApimoRoutesFile()
  const generatedAt = file ? Date.parse(file.generatedAt) : NaN
  const fileFresh =
    Boolean(file) && Number.isFinite(generatedAt) && Date.now() - generatedAt < MAX_AGE_MS && file!.routes.length > 0

  if (!options?.forceRefresh && fileFresh && file) {
    console.log(`Liste de routes servie depuis data/apimo-routes.json (générée le ${formatDayMonth(file.generatedAt)}).`)
    return mergeRoutes(file.routes)
  }

  try {
    const propertyRoutes = await fetchPropertyRoutes(supabaseUrl, anon)
    const saved = await writeApimoRoutesFile(propertyRoutes)
    console.log(`data/apimo-routes.json mis à jour (${saved.routes.length} fiches).`)
    return mergeRoutes(propertyRoutes)
  } catch (error) {
    if (file?.routes.length) {
      announceStaleFile(file, error instanceof ApimoHttpError && error.status === 429)
      return mergeRoutes(file.routes)
    }
    if (error instanceof ApimoHttpError && error.status === 429) {
      console.warn(
        `Quota quotidien Apimo atteint (HTTP 429).\ndata/apimo-routes.json absent : pré-rendu des pages statiques seulement.\nLes fiches seront pré-rendues après \`npm run sync:routes\`.`,
      )
      return staticRoutes()
    }
    throw error
  }
}
