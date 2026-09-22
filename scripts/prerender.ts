import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { collectRoutes } from './collect-routes'
import { loadEnvFiles } from './load-env'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = path.join(ROOT, 'dist')
const PREVIEW_PORT = process.env.PRERENDER_PORT ?? '4180'
const BASE = process.env.PRERENDER_BASE_URL ?? `http://127.0.0.1:${PREVIEW_PORT}`
const BASE_PATH = (process.env.VITE_BASE_PATH ?? '/fr').replace(/\/$/, '')

loadEnvFiles(ROOT)

function outputDir(route: string) {
  if (route === '/') return path.join(DIST, BASE_PATH)
  return path.join(DIST, BASE_PATH, route.replace(/^\//, ''))
}

async function waitForServer(url: string) {
  const started = Date.now()
  while (Date.now() - started < 20000) {
    try {
      const res = await fetch(url, { redirect: 'manual' })
      if (res.ok || res.status === 302) return
    } catch {
      /* still booting */
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`vite preview injoignable sur ${url}`)
}

async function renderRoute(
  browser: puppeteer.Browser,
  route: string,
) {
  const page = await browser.newPage()
  try {
    const url = `${BASE}${BASE_PATH}${route}`
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForSelector('h1', { timeout: 20000 })
    if (/^\/(acheter|louer)\/[^/]+$/.test(route)) {
      await page.waitForFunction(
        () => {
          const title = document.querySelector('h1')?.textContent?.trim() ?? ''
          return title.length > 0 && title !== 'Chargement...'
        },
        { timeout: 40000 },
      )
      await page.waitForSelector('.detail-gallery__main img', { timeout: 15000 }).catch(() => undefined)
    }
    const html = await page.content()
    const dir = outputDir(route)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'index.html'), html)
  } finally {
    await page.close()
  }
}

async function writeSpaShells() {
  const shellHtml = path.join(DIST, 'index.html')
  if (!existsSync(shellHtml)) throw new Error('dist/index.html absent après vite build')
  const frDir = path.join(DIST, BASE_PATH)
  await mkdir(frDir, { recursive: true })
  await copyFile(shellHtml, path.join(frDir, 'index.html'))
  await copyFile(shellHtml, path.join(frDir, '200.html'))
  await copyFile(shellHtml, path.join(frDir, '404.html'))
  await copyFile(shellHtml, path.join(DIST, '404.html'))
}

const routes = await collectRoutes()

if (process.env.VERCEL) {
  console.warn('Vercel : pré-rendu Puppeteer ignoré (Chrome système absent sur l’image de build).')
  await writeSpaShells()
  console.log(`${routes.size} routes conservées pour le sitemap ; HTML servi par le shell SPA.`)
} else {
const server = spawn(
  'npx',
  ['vite', 'preview', '--host', '127.0.0.1', '--port', PREVIEW_PORT, '--strictPort'],
  { cwd: ROOT, stdio: 'ignore' },
)

let browser: puppeteer.Browser | undefined
const failures: string[] = []
let ok = 0

try {
  await waitForServer(`${BASE}${BASE_PATH}/`)
  browser = await puppeteer.launch({ headless: true })
  const queue = [...routes]
  const workers = 2
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (queue.length) {
        const route = queue.shift()
        if (!route) return
        try {
          await renderRoute(browser!, route)
          ok++
          console.log(`OK ${route}`)
        } catch (error) {
          failures.push(route)
          console.error(`ÉCHEC ${route} : ${(error as Error).message}`)
        }
      }
    }),
  )

  if (failures.length) {
    const retry = [...failures]
    failures.length = 0
    for (const route of retry) {
      try {
        await renderRoute(browser!, route)
        ok++
        console.log(`OK (retry) ${route}`)
      } catch (error) {
        failures.push(route)
        console.error(`ÉCHEC (retry) ${route} : ${(error as Error).message}`)
      }
    }
  }

  const notFoundPage = await browser.newPage()
  await notFoundPage.goto(`${BASE}${BASE_PATH}/route-inexistante-test`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  })
  await notFoundPage.waitForSelector('h1', { timeout: 15000 })
  const notFound = await notFoundPage.content()
  await notFoundPage.close()
  await writeFile(path.join(DIST, '404.html'), notFound)
  await mkdir(path.join(DIST, BASE_PATH), { recursive: true })
  await writeFile(path.join(DIST, BASE_PATH, '404.html'), notFound)
  const homeHtml = path.join(DIST, BASE_PATH, 'index.html')
  const shellHtml = path.join(DIST, 'index.html')
  await copyFile(existsSync(homeHtml) ? homeHtml : shellHtml, path.join(DIST, BASE_PATH, '200.html'))
} finally {
  await browser?.close()
  server.kill()
}

console.log(`\n${ok}/${routes.size} routes pré-rendues`)
if (failures.length) {
  const quotaHint = failures.length > 3
  console.error(`Pré-rendu incomplet (${failures.length} route(s) en échec). Le dossier dist/ du build Vite est conservé.`)
  if (quotaHint) {
    console.error(
      'Si Apimo renvoie 429, relancer `npm run sync:routes` hors quota puis reconstruire. Les pages déjà écrites dans dist/ restent utilisables.',
    )
  }
  console.error(`Routes en échec : ${failures.join(', ')}`)
  process.exit(1)
}
}
