// Génère les images Open Graph des fiches (aperçus WhatsApp, Facebook, LinkedIn…).
//
// Pourquoi : les photos Apimo sont servies en « original » (souvent 1 à 3 Mo, jusqu'à 4096 px)
// depuis media.apimo.pro, dont le robots.txt interdit tout (« Disallow: / »). WhatsApp rejette
// alors l'image et se rabat sur l'apple-touch-icon du site (vignette blanche puis logo « H »).
// On produit donc, au build, un JPEG 1200×630 léger hébergé sur hamacpatrimoine.com.
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp, { type Metadata, type Sharp } from 'sharp'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630
export const OG_TARGET_MIN_BYTES = 100 * 1024
export const OG_TARGET_MAX_BYTES = 250 * 1024
/** Dossier servi sous /fr/images/… (Vite copie public/ à la racine de dist, Vercel réécrit /fr/images). */
export const LISTING_OG_SUBDIR = 'images/og/listings'

const QUALITIES = [88, 84, 80, 76, 72, 68, 64, 60]
const MIN_SOURCE_WIDTH = 600
const MIN_SOURCE_HEIGHT = 315
const MAX_CANDIDATES = 5
const FETCH_TIMEOUT_MS = 30_000
const FETCH_ATTEMPTS = 3

export type OgPicture = { url?: string; rank?: number; internet?: unknown }

export type OgImageResult =
  | {
      ok: true
      file: string
      bytes: number
      quality: number
      sourceUrl: string
      sourceIndex: number
      layout: 'cover' | 'contain'
      rejected: string[]
    }
  | { ok: false; rejected: string[] }

/** Photos publiables triées par rang Apimo (la photo principale d'abord). */
export function candidatePictures(pictures: OgPicture[]): string[] {
  return [...pictures]
    .filter((p) => p.internet !== 0 && p.internet !== false)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map((p) => p.url)
    .filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url))
}

export function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}

/** Nom versionné : un changement de photo change l'URL, donc contourne les caches WhatsApp/Facebook. */
export function versionedFileName(listingId: string, bytes: Buffer) {
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 10)
  return `${safeName(listingId)}-${hash}.jpg`
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function fetchWithRetry(url: string, attempts = FETCH_ATTEMPTS, timeoutMs = FETCH_TIMEOUT_MS) {
  let lastError: Error = new Error('aucune tentative')
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' })
      if (res.ok) return Buffer.from(await res.arrayBuffer())
      lastError = new Error(`HTTP ${res.status}`)
      // 4xx (hors 408/429) : inutile d'insister.
      if (res.status < 500 && res.status !== 408 && res.status !== 429) break
    } catch (error) {
      lastError = error as Error
    }
    if (attempt < attempts) await sleep(500 * 2 ** (attempt - 1))
  }
  throw lastError
}

/**
 * Image « vide » : quasi uniforme (blanche, noire ou grise). Mesuré sur une miniature
 * pour rester rapide. Seuils volontairement prudents pour ne pas rejeter un ciel ou un mur clair.
 */
export async function isBlankImage(input: Buffer) {
  const { channels } = await sharp(input).resize(64, 64, { fit: 'fill' }).removeAlpha().stats()
  const maxStdev = Math.max(...channels.map((c) => c.stdev))
  return maxStdev < 6
}

async function render(input: Buffer, layout: 'cover' | 'contain', quality: number) {
  const base = sharp(input).rotate().flatten({ background: '#ffffff' }).toColourspace('srgb')
  let pipeline: Sharp
  if (layout === 'cover') {
    pipeline = base.resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'centre' })
  } else {
    // Photo verticale : on la garde entière sur un fond flou de la même photo plutôt que
    // de n'en garder qu'une bande horizontale.
    const background = await sharp(input)
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover' })
      .blur(30)
      .modulate({ brightness: 0.85 })
      .toBuffer()
    const foreground = await base.resize(OG_WIDTH, OG_HEIGHT, { fit: 'inside' }).toBuffer()
    pipeline = sharp(background).composite([{ input: foreground, gravity: 'centre' }])
  }
  return pipeline
    // Réglages mozjpeg sans « optimiseScans » (qui rend le JPEG progressif) : JPEG baseline,
    // le plus sûr pour les générateurs d'aperçus.
    .jpeg({
      quality,
      progressive: false,
      chromaSubsampling: '4:2:0',
      trellisQuantisation: true,
      overshootDeringing: true,
      quantisationTable: 3,
    })
    .toBuffer()
}

/** Encode en visant 100–250 Ko : la meilleure qualité qui tient sous 250 Ko. */
export async function encodeOgJpeg(input: Buffer, layout: 'cover' | 'contain') {
  let last: { bytes: Buffer; quality: number } | null = null
  for (const quality of QUALITIES) {
    const bytes = await render(input, layout, quality)
    last = { bytes, quality }
    if (bytes.length <= OG_TARGET_MAX_BYTES) return last
  }
  return last!
}

/** Contrôle du fichier produit : JPEG décodable, 1200×630, pas vide, pas trop lourd. */
export async function validateOgJpeg(bytes: Buffer) {
  const problems: string[] = []
  try {
    const meta = await sharp(bytes).metadata()
    if (meta.format !== 'jpeg') problems.push(`format ${meta.format}`)
    if (meta.width !== OG_WIDTH || meta.height !== OG_HEIGHT) problems.push(`taille ${meta.width}×${meta.height}`)
    if (meta.isProgressive) problems.push('JPEG progressif')
    await sharp(bytes).raw().toBuffer()
    if (await isBlankImage(bytes)) problems.push('image uniforme / blanche')
  } catch (error) {
    problems.push(`non décodable (${(error as Error).message})`)
  }
  if (bytes.length > 300 * 1024) problems.push(`trop lourde (${Math.round(bytes.length / 1024)} Ko)`)
  return problems
}

/** Prépare une photo source : décodable, assez grande, pas vide. Retourne la mise en page adaptée. */
export async function inspectSource(input: Buffer): Promise<{ layout: 'cover' | 'contain' } | { problem: string }> {
  let meta: Metadata
  try {
    meta = await sharp(input).metadata()
  } catch (error) {
    return { problem: `non décodable (${(error as Error).message})` }
  }
  const rotated = (meta.orientation ?? 1) >= 5
  const width = (rotated ? meta.height : meta.width) ?? 0
  const height = (rotated ? meta.width : meta.height) ?? 0
  if (width < MIN_SOURCE_WIDTH || height < MIN_SOURCE_HEIGHT) return { problem: `trop petite (${width}×${height})` }
  try {
    if (await isBlankImage(input)) return { problem: 'image uniforme / blanche' }
  } catch (error) {
    return { problem: `non décodable (${(error as Error).message})` }
  }
  return { layout: height > width ? 'contain' : 'cover' }
}

export type Fetcher = (url: string) => Promise<Buffer>

export type RenderedOg =
  | {
      ok: true
      bytes: Buffer
      quality: number
      sourceUrl: string
      sourceIndex: number
      layout: 'cover' | 'contain'
      rejected: string[]
    }
  | { ok: false; rejected: string[] }

/**
 * Produit le JPEG de partage à partir des URL candidates (photo principale puis suivantes),
 * sans rien écrire. Partagé par le build et les fonctions Vercel (og-render, og-image).
 * `deadline` (timestamp ms) : on n'essaie plus de nouvelle photo une fois l'échéance passée.
 */
export async function renderOgImage(urls: string[], fetcher: Fetcher, deadline?: number): Promise<RenderedOg> {
  const rejected: string[] = []
  const candidates = urls.slice(0, MAX_CANDIDATES)
  if (candidates.length === 0) return { ok: false, rejected: ['aucune photo publiable'] }

  for (const [index, url] of candidates.entries()) {
    const label = `photo ${index + 1}`
    if (deadline && Date.now() >= deadline) {
      rejected.push(`${label} : délai dépassé`)
      break
    }
    let input: Buffer
    try {
      input = await fetcher(url)
    } catch (error) {
      rejected.push(`${label} : téléchargement impossible (${(error as Error).message})`)
      continue
    }
    const inspection = await inspectSource(input)
    if ('problem' in inspection) {
      rejected.push(`${label} : ${inspection.problem}`)
      continue
    }
    try {
      const { bytes, quality } = await encodeOgJpeg(input, inspection.layout)
      const problems = await validateOgJpeg(bytes)
      if (problems.length) {
        rejected.push(`${label} : sortie invalide (${problems.join(', ')})`)
        continue
      }
      return { ok: true, bytes, quality, sourceUrl: url, sourceIndex: index, layout: inspection.layout, rejected }
    } catch (error) {
      rejected.push(`${label} : conversion impossible (${(error as Error).message})`)
    }
  }
  return { ok: false, rejected }
}

/**
 * Essaie la photo principale puis les suivantes. Écrit le JPEG validé dans outDir.
 * Ne lève jamais : un échec complet renvoie ok:false avec le détail des rejets.
 */
export async function generateListingOgImage(
  listingId: string,
  pictures: OgPicture[],
  outDir: string,
  fetcher: Fetcher = (url) => fetchWithRetry(url),
): Promise<OgImageResult> {
  const rendered = await renderOgImage(candidatePictures(pictures), fetcher)
  if (!rendered.ok) return rendered
  const file = versionedFileName(listingId, rendered.bytes)
  await mkdir(outDir, { recursive: true })
  await writeFile(path.join(outDir, file), rendered.bytes)
  const { bytes, ...rest } = rendered
  return { ...rest, ok: true, file, bytes: bytes.length }
}

/** Exécute des tâches avec une concurrence limitée (évite de saturer media.apimo.pro). */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++
        results[index] = await task(items[index])
      }
    }),
  )
  return results
}

/** Vrai si une photo mieux classée a été écartée pour une raison réseau (et non de contenu). */
export function needsMainPhotoRetry(result: OgImageResult) {
  const firstUsed = result.ok ? result.sourceIndex : Number.POSITIVE_INFINITY
  return result.rejected.some((reason) => {
    const index = Number(reason.match(/^photo (\d+)/)?.[1] ?? 0) - 1
    return index < firstUsed && reason.includes('téléchargement impossible')
  })
}
