// Audit des balises de partage (Open Graph / Twitter) dans dist/, après le pré-rendu Chromium.
// Usage : npx tsx scripts/check-og-meta.ts [--verbose]
// Code de sortie 1 si une page a des balises manquantes, dupliquées, une image non publique
// ou un fichier image absent / invalide. Les fiches retombées sur l'image Hamac par défaut
// sont listées mais ne bloquent pas (elles sont justifiées dans dist/og-images-report.json).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_OG_IMAGE, SERVED_ORIGIN, SERVED_SITE_URL } from '../src/config/site'
import { LISTING_OG_SUBDIR, OG_HEIGHT, OG_WIDTH, validateOgJpeg } from './og-images'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = path.join(ROOT, 'dist')
const BASE_PATH = (process.env.VITE_BASE_PATH ?? '/fr').replace(/\/$/, '')

const REQUIRED_ONCE = [
  'og:title',
  'og:description',
  'og:url',
  'og:image',
  'og:image:secure_url',
  'og:image:alt',
  'twitter:card',
  'twitter:image',
]
const OPTIONAL_ONCE = ['og:image:width', 'og:image:height', 'og:image:type', 'og:type', 'og:site_name', 'twitter:image:alt']

export type MetaTag = { key: string; content: string }

function decodeEntities(value: string) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

export function readMetaTags(html: string): MetaTag[] {
  const head = html.split(/<\/head>/i)[0] ?? html
  const tags: MetaTag[] = []
  for (const match of head.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0]
    const key = tag.match(/\b(?:property|name)="([^"]+)"/i)?.[1]
    const content = tag.match(/\bcontent="([^"]*)"/i)?.[1]
    if (key && content !== undefined) tags.push({ key, content: decodeEntities(content) })
  }
  return tags
}

/** Chemin dans dist/ d'une image servie par le site (null si l'URL n'est pas chez nous). */
export function distPathForImage(url: string) {
  const prefix = `${SERVED_ORIGIN}${BASE_PATH}/`
  if (!url.startsWith(prefix)) return null
  // Vite copie public/ à la racine de dist ; Vercel réécrit /fr/images/* → /images/*.
  return path.join(DIST, decodeURIComponent(url.slice(prefix.length).split('?')[0]))
}

/** Problèmes structurels d'une page (pures vérifications de balises). */
export function auditTags(tags: MetaTag[], route: string): string[] {
  const problems: string[] = []
  const count = (key: string) => tags.filter((t) => t.key === key).length
  const value = (key: string) => tags.find((t) => t.key === key)?.content ?? ''
  for (const key of REQUIRED_ONCE) {
    const n = count(key)
    if (n !== 1) problems.push(`${key} présent ${n} fois`)
  }
  for (const key of OPTIONAL_ONCE) {
    if (count(key) > 1) problems.push(`${key} dupliqué`)
  }
  const image = value('og:image')
  if (!/^https:\/\//.test(image)) problems.push(`og:image non HTTPS absolue : ${image}`)
  if (/media\.apimo\.pro/i.test(image)) problems.push('og:image pointe encore vers media.apimo.pro')
  if (value('og:image:secure_url') !== image) problems.push('og:image:secure_url ≠ og:image')
  if (value('twitter:image') !== image) problems.push('twitter:image ≠ og:image')
  if (value('twitter:card') !== 'summary_large_image') problems.push('twitter:card inattendu')
  const sized = ['og:image:width', 'og:image:height', 'og:image:type'].map(count)
  if (new Set(sized).size !== 1) problems.push('og:image:width/height/type incomplets')
  const ogUrl = value('og:url')
  if (route !== '/' && !ogUrl.endsWith(route)) problems.push(`og:url ${ogUrl} ≠ route ${route}`)
  if (!/^https:\/\//.test(ogUrl)) problems.push('og:url non HTTPS')
  return problems
}

function listPages(dir: string, base = ''): Array<{ route: string; file: string }> {
  const pages: Array<{ route: string; file: string }> = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'assets' || entry === 'images') continue
      pages.push(...listPages(full, `${base}/${entry}`))
    } else if (entry === 'index.html') {
      pages.push({ route: base || '/', file: full })
    }
  }
  return pages
}

async function main() {
  const verbose = process.argv.includes('--verbose')
  const pagesRoot = path.join(DIST, BASE_PATH)
  if (!existsSync(pagesRoot)) throw new Error(`${pagesRoot} absent : lancer le build d'abord`)
  const pages = listPages(pagesRoot)
  const errors: string[] = []
  const imageChecks = new Map<string, Promise<string[]>>()
  let listingPages = 0
  let listingWithPhoto = 0
  const listingDefault: string[] = []

  for (const page of pages) {
    const html = readFileSync(page.file, 'utf8')
    const tags = readMetaTags(html)
    const problems = auditTags(tags, page.route)
    const image = tags.find((t) => t.key === 'og:image')?.content ?? ''
    const isListing = /^\/(acheter|louer)\/[^/]+$/.test(page.route)
    if (isListing) {
      listingPages++
      if (image === DEFAULT_OG_IMAGE) listingDefault.push(page.route)
      else if (image.startsWith(`${SERVED_SITE_URL}/${LISTING_OG_SUBDIR}/`)) {
        listingWithPhoto++
        const width = tags.find((t) => t.key === 'og:image:width')?.content
        const height = tags.find((t) => t.key === 'og:image:height')?.content
        if (width !== String(OG_WIDTH) || height !== String(OG_HEIGHT)) problems.push(`dimensions annoncées ${width}×${height}`)
      } else problems.push(`og:image de fiche inattendue : ${image}`)
      if (!tags.some((t) => t.key === 'hamac:og-route' && t.content === page.route)) problems.push('marqueur hamac:og-route absent')
    }
    const local = distPathForImage(image)
    if (local) {
      if (!existsSync(local)) problems.push(`fichier image absent de dist : ${path.relative(DIST, local)}`)
      else if (local.includes(`${path.sep}og${path.sep}listings${path.sep}`)) {
        if (!imageChecks.has(local)) imageChecks.set(local, validateOgJpeg(readFileSync(local)))
        const imageProblems = await imageChecks.get(local)!
        problems.push(...imageProblems.map((p) => `image ${path.basename(local)} : ${p}`))
      }
    } else if (image && !image.startsWith(SERVED_ORIGIN)) {
      // Image externe (blog, quartiers…) : tolérée hors fiches, signalée en mode verbeux.
      if (verbose) console.log(`info ${page.route} : image externe ${image}`)
    }
    if (problems.length) errors.push(`${page.route} : ${problems.join(' | ')}`)
  }

  const reportPath = path.join(DIST, 'og-images-report.json')
  const report = existsSync(reportPath)
    ? (JSON.parse(readFileSync(reportPath, 'utf8')) as Array<{ id: string; ok: boolean; rejected: string[]; bytes?: number }>)
    : []
  console.log(`Pages auditées : ${pages.length}`)
  console.log(`Fiches : ${listingPages} — photo du bien : ${listingWithPhoto}, image Hamac par défaut : ${listingDefault.length}`)
  for (const route of listingDefault) {
    const id = route.split('/').pop()
    const reason = report.find((r) => r.id === id)?.rejected.join(' ; ') ?? 'fiche absente du flux Apimo au build'
    console.log(`  défaut ${route} : ${reason}`)
  }
  const sizes = report.filter((r) => r.ok && r.bytes).map((r) => r.bytes!)
  if (sizes.length) {
    const kb = (n: number) => `${Math.round(n / 1024)} Ko`
    console.log(`Poids images : min ${kb(Math.min(...sizes))}, max ${kb(Math.max(...sizes))}, moyenne ${kb(sizes.reduce((a, b) => a + b, 0) / sizes.length)}`)
  }
  if (errors.length) {
    console.error(`\n${errors.length} page(s) en erreur :`)
    for (const error of errors) console.error(`  ${error}`)
    process.exit(1)
  }
  console.log('Balises de partage : OK')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main()
}
