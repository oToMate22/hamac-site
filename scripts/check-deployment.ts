// Vérification d'un déploiement (Preview, production ou émulation locale) : lecture seule.
// Usage : npx tsx scripts/check-deployment.ts https://<preview>.vercel.app [--max=200] [--bypass=<jeton>]
//   - sitemap dynamique → chaque fiche : 200, balises OG/Twitter uniques et complètes, canonical,
//     JSON-LD valide, un seul h1, contenu présent sans JavaScript, image de partage téléchargeable et valide
//   - catalogues /fr/acheter et /fr/louer, identifiant inexistant (404), en-têtes de cache
// Code de sortie 1 au moindre écart.
import { auditTags, readMetaTags } from './check-og-meta'
import { validateOgJpeg } from './og-images'

const base = (process.argv[2] ?? '').replace(/\/$/, '')
if (!/^https?:\/\//.test(base)) {
  console.error('Usage : npx tsx scripts/check-deployment.ts <url de base> [--max=200] [--bypass=<jeton>]')
  process.exit(2)
}
const max = Number(process.argv.find((a) => a.startsWith('--max='))?.split('=')[1] ?? 500)
const bypass = process.argv.find((a) => a.startsWith('--bypass='))?.split('=')[1]
const headers: Record<string, string> = { 'User-Agent': 'WhatsApp/2.23.20.0' }
if (bypass) headers['x-vercel-protection-bypass'] = bypass

const problems: string[] = []
const get = (path: string) => fetch(path.startsWith('http') ? path : `${base}${path}`, { headers, redirect: 'manual' })
const timings: number[] = []

const sitemapRes = await get('/fr/sitemap.xml')
const sitemap = await sitemapRes.text()
if (sitemapRes.status !== 200) problems.push(`sitemap HTTP ${sitemapRes.status}`)
const listingRoutes = [...sitemap.matchAll(/<loc>[^<]*\/fr(\/(?:acheter|louer)\/\d+)<\/loc>/g)].map((m) => m[1]).slice(0, max)
console.log(`Sitemap : ${listingRoutes.length} fiches (${sitemapRes.headers.get('x-vercel-cache') ?? 'cache ?'})`)

let images = 0
let defaults = 0
const sizes: number[] = []
for (const route of listingRoutes) {
  const start = performance.now()
  const res = await get(`/fr${route}`)
  const html = await res.text()
  timings.push(performance.now() - start)
  const tags = readMetaTags(html)
  const issues = auditTags(tags, route)
  if (res.status !== 200) issues.push(`HTTP ${res.status}`)
  if ((html.match(/<h1\b/g) ?? []).length !== 1) issues.push('h1')
  if (!html.includes('id="ld-listing"')) issues.push('JSON-LD fiche absent')
  for (const block of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(block[1])
    } catch {
      issues.push('JSON-LD invalide')
    }
  }
  if (html.includes('Chargement...')) issues.push('écran de chargement')
  const og = tags.find((t) => t.key === 'og:image')?.content ?? ''
  if (og.includes('hamac-og-1200x630')) defaults++
  else if (og) {
    const img = await get(og)
    const bytes = Buffer.from(await img.arrayBuffer())
    const imageIssues = img.status === 200 ? await validateOgJpeg(bytes) : [`HTTP ${img.status}`]
    images++
    sizes.push(bytes.length)
    issues.push(...imageIssues.map((p) => `image : ${p}`))
  }
  if (issues.length) problems.push(`${route} : ${issues.join(', ')}`)
}

for (const path of ['/fr/acheter', '/fr/louer']) {
  const res = await get(path)
  const html = await res.text()
  const issues = auditTags(readMetaTags(html), path.replace('/fr', ''))
  if (res.status !== 200) issues.push(`HTTP ${res.status}`)
  if (!/href="\/fr\/(acheter|louer)\/\d+/.test(html) && path === '/fr/acheter') issues.push('aucun lien vers les fiches')
  if (issues.length) problems.push(`${path} : ${issues.join(', ')}`)
}
const unknown = await get('/fr/acheter/10000001')
if (unknown.status !== 404) problems.push(`identifiant inexistant : HTTP ${unknown.status} (attendu 404)`)
const robots = await get('/robots.txt')
console.log(`robots.txt : ${(await robots.text()).split('\n')[1] ?? '?'}`)

const sorted = [...timings].sort((a, b) => a - b)
console.log(`Fiches vérifiées : ${listingRoutes.length}, images : ${images} (+${defaults} par défaut)`)
if (sizes.length) console.log(`Poids images : ${Math.round(Math.min(...sizes) / 1024)}–${Math.round(Math.max(...sizes) / 1024)} Ko`)
if (sorted.length) console.log(`Temps de réponse fiches : p50 ${Math.round(sorted[Math.floor(sorted.length / 2)])} ms, p95 ${Math.round(sorted[Math.floor(sorted.length * 0.95)])} ms`)
if (problems.length) {
  console.error(`\n${problems.length} écart(s) :`)
  for (const p of problems.slice(0, 50)) console.error(`  ${p}`)
  process.exit(1)
}
console.log('Déploiement conforme')
