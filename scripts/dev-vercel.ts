// Émulation locale du routage Vercel pour les tests d'intégration (sans compte ni déploiement) :
// redirections de vercel.json → fichiers statiques de dist/ → réécritures → fonctions (dist-ssr).
// Usage : npx tsx scripts/dev-vercel.ts [port]   (après `npm run build`)
// Les fonctions reçoivent un contexte injectable (env, fetch, étiquettes de cache enregistrées).
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = path.join(ROOT, 'dist')

type Rule = { source: string; destination: string; permanent?: boolean }
type VercelConfig = { redirects?: Rule[]; rewrites?: Rule[]; proxy?: { entrypoint: string; matcher: string[] } }

export type HarnessContext = {
  env: Record<string, string | undefined>
  fetch?: typeof fetch
  photoFetcher?: (url: string) => Promise<Buffer>
  /** Étiquettes posées par les fonctions (addCacheTag), par URL. */
  tagged: Array<{ url: string; tags: string[] }>
  /** Étiquettes purgées (invalidateByTag). */
  invalidated: string[][]
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

/** Motif Vercel (`:param`, `:param*`) → expression régulière avec groupes nommés. */
function compile(source: string) {
  const names: string[] = []
  const pattern = source
    .split('/')
    .map((part) => {
      const match = part.match(/^:([a-zA-Z_]+)(\*)?$/)
      if (!match) return part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      names.push(match[1])
      return match[2] ? '(.*)' : '([^/]+)'
    })
    .join('/')
  return { re: new RegExp(`^${pattern}$`), names }
}

function applyRule(rule: Rule, pathname: string) {
  const { re, names } = compile(rule.source)
  const match = pathname.match(re)
  if (!match) return null
  let destination = rule.destination
  names.forEach((name, i) => {
    destination = destination.replaceAll(`:${name}*`, match[i + 1] ?? '').replaceAll(`:${name}`, match[i + 1] ?? '')
  })
  return destination
}

function staticFile(pathname: string) {
  const clean = decodeURIComponent(pathname)
  const candidates = [path.join(DIST, clean), path.join(DIST, clean, 'index.html')]
  for (const file of candidates) {
    if (!file.startsWith(DIST)) continue
    if (existsSync(file) && statSync(file).isFile()) return file
  }
  return null
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

export async function startHarness(port: number, ctx: HarnessContext): Promise<{ server: Server; url: string }> {
  const config = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')) as VercelConfig
  // Routing Middleware (src/proxy.ts) : anciennes URL de l'ancien site Apimo.
  const middleware = config.proxy
    ? ((await import(pathToFileURL(path.join(ROOT, config.proxy.entrypoint)).href)) as { default: (r: Request) => Response })
    : null
  const pages = await import(pathToFileURL(path.join(ROOT, 'dist-ssr/pages.js')).href)
  const og = await import(pathToFileURL(path.join(ROOT, 'dist-ssr/og.js')).href)
  const functions: Record<string, (request: Request) => Promise<Response>> = {
    '/api/listing': (r) => pages.handleListing(r, pageCtx(r)),
    '/api/catalog': (r) => pages.handleCatalog(r, pageCtx(r)),
    '/api/sitemap': (r) => pages.handleSitemap(r, pageCtx(r)),
    '/api/revalidate': (r) => pages.handleRevalidate(r, pageCtx(r)),
    '/api/og-image': (r) => og.handleOgImage(r, { env: ctx.env, fetch: ctx.fetch, photoFetcher: ctx.photoFetcher }),
    '/api/og-render': (r) => og.handleOgRender(r, { env: ctx.env, fetch: ctx.fetch, photoFetcher: ctx.photoFetcher }),
  }
  function pageCtx(request: Request) {
    return {
      env: ctx.env,
      fetch: ctx.fetch,
      addCacheTag: (tags: string[]) => ctx.tagged.push({ url: request.url, tags }),
      invalidateByTag: async (tags: string[]) => {
        ctx.invalidated.push(tags)
      },
    }
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
      let pathname = url.pathname

      for (const rule of config.redirects ?? []) {
        const destination = applyRule(rule, pathname)
        if (destination) {
          res.writeHead(rule.permanent === false ? 307 : 308, { Location: destination })
          res.end()
          return
        }
      }

      if (middleware && config.proxy!.matcher.some((source) => applyRule({ source, destination: '/' }, pathname))) {
        const response = middleware.default(new Request(url.href))
        if (!response.headers.get('x-middleware-next')) {
          const headers: Record<string, string> = {}
          response.headers.forEach((value, key) => (headers[key] = value))
          res.writeHead(response.status, headers)
          res.end(Buffer.from(await response.arrayBuffer()))
          return
        }
      }

      // Vercel : le système de fichiers passe avant les réécritures.
      let file = staticFile(pathname)
      let search = url.search
      if (!file) {
        for (const rule of config.rewrites ?? []) {
          const destination = applyRule(rule, pathname)
          if (!destination) continue
          const target = new URL(destination, url)
          for (const [key, value] of url.searchParams) if (!target.searchParams.has(key)) target.searchParams.append(key, value)
          pathname = target.pathname
          search = target.search
          file = staticFile(pathname)
          break
        }
      }

      const handler = functions[pathname]
      if (handler) {
        const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
        const request = new Request(`${url.origin}${pathname}${search}`, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body,
        })
        const response = await handler(request)
        const headers: Record<string, string> = {}
        response.headers.forEach((value, key) => (headers[key] = value))
        res.writeHead(response.status, headers)
        res.end(Buffer.from(await response.arrayBuffer()))
        return
      }
      if (file) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' })
        res.end(readFileSync(file))
        return
      }
      const notFound = path.join(DIST, 'fr/404.html')
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(existsSync(notFound) ? readFileSync(notFound) : 'Not found')
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end(String((error as Error).stack ?? error))
    }
  })
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  return { server, url: `http://127.0.0.1:${port}` }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const port = Number(process.argv[2] ?? 4300)
  const { url } = await startHarness(port, { env: process.env, tagged: [], invalidated: [] })
  console.log(`Émulation Vercel : ${url}/fr/`)
}
