import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITE_ORIGIN, SITE_URL } from '../src/config/site'
import { collectRoutes } from './collect-routes'
import { loadEnvFiles } from './load-env'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = path.join(ROOT, 'dist')
const BASE_PATH = (process.env.VITE_BASE_PATH ?? '/fr').replace(/\/$/, '')

loadEnvFiles(ROOT)

const routes = await collectRoutes()
const lastmod = new Date().toISOString().slice(0, 10)

const urls = [...routes]
  .sort((a, b) => a.localeCompare(b))
  .map((route) => {
    const loc = `${SITE_URL}${route === '/' ? '/' : route}`
    const priority = route === '/' ? '1.0' : route.split('/').length <= 2 ? '0.8' : '0.6'
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`
  })
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

function hostnameOf(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./i, '')
    .toLowerCase()
}

const productionHost = hostnameOf(process.env.VERCEL_PROJECT_PRODUCTION_URL ?? '')
const siteHost = hostnameOf(SITE_ORIGIN)
const indexable =
  process.env.INDEXABLE === '1' ||
  (process.env.INDEXABLE !== '0' && productionHost !== '' && productionHost === siteHost)
const robots = `User-agent: *
${indexable ? 'Allow: /' : 'Disallow: /'}

Sitemap: ${SITE_URL}/sitemap.xml
`

await writeFile(path.join(DIST, 'robots.txt'), robots)
await mkdir(path.join(DIST, BASE_PATH), { recursive: true })
await writeFile(path.join(DIST, BASE_PATH, 'sitemap.xml'), xml)
console.log(`sitemap : ${routes.size} URLs → ${SITE_URL}/sitemap.xml`)
console.log(
  `robots.txt : ${indexable ? 'Allow: /' : 'Disallow: /'} (INDEXABLE=${process.env.INDEXABLE ?? 'unset'}, production=${productionHost || 'local'})`,
)
